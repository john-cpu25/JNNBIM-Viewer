import type { ClashTestItem } from './clashState';

const DB_NAME = 'jnn_clash_store';
const DB_VERSION = 1;
const STORE_NAME = 'clash_tests';

export interface ClashTestsRecord {
  modelsKey: string;
  tests: ClashTestItem[];
  updatedAt: number;
}

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined' && window.indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Creates a deterministic key for the currently open models.
 * If model ids or file names are passed, they are sorted and joined.
 */
export function computeModelsKey(keys: string[]): string {
  const filtered = keys.filter(Boolean).map((k) => k.trim());
  if (filtered.length === 0) return 'default_session';
  return [...new Set(filtered)].sort().join('::');
}

function openClashDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'modelsKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open clash IndexedDB'));
  });
}

/**
 * Saves clash tests into IndexedDB keyed by modelsKey.
 */
export async function saveClashTests(modelsKey: string, tests: ClashTestItem[]): Promise<boolean> {
  if (!isIndexedDBAvailable() || !modelsKey) return false;
  try {
    const db = await openClashDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: ClashTestsRecord = {
        modelsKey,
        tests,
        updatedAt: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        console.warn('[clashStorage] saveClashTests error:', req.error);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[clashStorage] saveClashTests exception:', err);
    return false;
  }
}

/**
 * Loads clash tests from IndexedDB keyed by modelsKey.
 */
export async function loadClashTests(modelsKey: string): Promise<ClashTestItem[] | null> {
  if (!isIndexedDBAvailable() || !modelsKey) return null;
  try {
    const db = await openClashDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(modelsKey);
      req.onsuccess = () => {
        const record = req.result as ClashTestsRecord | undefined;
        resolve(record ? record.tests : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('[clashStorage] loadClashTests exception:', err);
    return null;
  }
}

/**
 * Serializes test configs to JSON string.
 */
export function exportTestsToJson(tests: ClashTestItem[]): string {
  // Strip transient status or runtime results if desired, or keep as snapshot
  return JSON.stringify(tests, null, 2);
}

/**
 * Deserializes JSON string back to test configs, with basic validation.
 */
export function importTestsFromJson(jsonStr: string): ClashTestItem[] {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      throw new Error('Imported JSON is not an array');
    }
    return parsed.filter(
      (item): item is ClashTestItem =>
        typeof item === 'object' && item !== null && typeof item.id === 'string' && typeof item.name === 'string',
    );
  } catch (err) {
    console.warn('[clashStorage] Failed to import tests JSON:', err);
    throw err;
  }
}

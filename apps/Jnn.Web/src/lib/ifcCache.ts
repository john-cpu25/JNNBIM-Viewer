import type { JnnModel } from '../domain/model';

export interface CachedIfcModel {
  sha256: string;
  filename: string;
  fileSize: number;
  fragBuffer: ArrayBuffer;
  jnnModel: JnnModel;
  createdAt: number;
  lastAccessedAt: number;
}

export interface CacheStats {
  count: number;
  totalBytes: number;
  items: Array<{
    sha256: string;
    filename: string;
    fileSize: number;
    cachedSize: number;
    createdAt: number;
    lastAccessedAt: number;
  }>;
}

const DB_NAME = 'jnn_ifc_cache';
const DB_VERSION = 1;
const STORE_NAME = 'cached_models';

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined' && window.indexedDB !== null;
  } catch {
    return false;
  }
}

export async function computeSha256(buffer: Uint8Array): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer as unknown as BufferSource);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback below
    }
  }
  // Fallback hash for environments without SubtleCrypto
  let h = 0x811c9dc5;
  for (let i = 0; i < buffer.length; i++) {
    h ^= buffer[i]!;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0') + '-' + buffer.length;
}

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'sha256' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

export async function getCachedIfcModel(sha256: string): Promise<CachedIfcModel | null> {
  if (!isIndexedDBAvailable() || !sha256) return null;
  try {
    const db = await openCacheDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(sha256);
      req.onsuccess = () => {
        const result = req.result as CachedIfcModel | undefined;
        resolve(result || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('[ifcCache] getCachedIfcModel error:', err);
    return null;
  }
}

export async function saveCachedIfcModel(record: CachedIfcModel): Promise<boolean> {
  if (!isIndexedDBAvailable() || !record.sha256) return false;
  try {
    const db = await openCacheDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        console.warn('[ifcCache] saveCachedIfcModel error:', req.error);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[ifcCache] saveCachedIfcModel exception:', err);
    return false;
  }
}

export async function clearIfcCache(): Promise<boolean> {
  if (!isIndexedDBAvailable()) return false;
  try {
    const db = await openCacheDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('[ifcCache] clearIfcCache error:', err);
    return false;
  }
}

export async function getIfcCacheStats(): Promise<CacheStats> {
  const empty: CacheStats = { count: 0, totalBytes: 0, items: [] };
  if (!isIndexedDBAvailable()) return empty;
  try {
    const db = await openCacheDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result || []) as CachedIfcModel[];
        let totalBytes = 0;
        const items = records.map((r) => {
          const cachedSize = r.fragBuffer ? r.fragBuffer.byteLength : 0;
          totalBytes += cachedSize;
          return {
            sha256: r.sha256,
            filename: r.filename,
            fileSize: r.fileSize,
            cachedSize,
            createdAt: r.createdAt,
            lastAccessedAt: r.lastAccessedAt,
          };
        });
        resolve({ count: records.length, totalBytes, items });
      };
      req.onerror = () => resolve(empty);
    });
  } catch (err) {
    console.warn('[ifcCache] getIfcCacheStats error:', err);
    return empty;
  }
}

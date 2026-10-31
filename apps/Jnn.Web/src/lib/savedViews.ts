import type { CameraState, SectionSpec } from '../viewer/ViewerAdapter';

export interface SavedView {
  id: string;
  name: string;
  camera: CameraState;
  section: SectionSpec | null;
  visibility: {
    hidden: string[];
    isolated: string[];
  };
  xray: boolean;
  thumbnail: string;
  createdAt: number;
}

export const MAX_SAVED_VIEWS = 50;

export function getSavedViewsStorageKey(modelId: string): string {
  const safeId = modelId ? modelId.trim().replace(/[^a-zA-Z0-9_-]/g, '_') : 'default';
  return `jnn-saved-views-${safeId}`;
}

export function isValidSavedView(item: unknown): item is SavedView {
  if (!item || typeof item !== 'object') return false;
  const v = item as Partial<SavedView>;
  if (typeof v.id !== 'string' || typeof v.name !== 'string') return false;
  if (!v.camera || typeof v.camera !== 'object') return false;
  if (!Array.isArray(v.camera.position) || v.camera.position.length !== 3) return false;
  if (!Array.isArray(v.camera.target) || v.camera.target.length !== 3) return false;
  if (v.camera.projection !== 'perspective' && v.camera.projection !== 'orthographic') return false;
  if (!v.visibility || typeof v.visibility !== 'object') return false;
  if (!Array.isArray(v.visibility.hidden) || !Array.isArray(v.visibility.isolated)) return false;
  return true;
}

export function loadSavedViews(modelId: string): SavedView[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(getSavedViewsStorageKey(modelId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSavedView).slice(0, MAX_SAVED_VIEWS);
  } catch (err) {
    console.warn('Failed to load saved views from localStorage:', err);
    return [];
  }
}

export function saveSavedViews(modelId: string, views: SavedView[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const valid = views.filter(isValidSavedView).slice(0, MAX_SAVED_VIEWS);
    window.localStorage.setItem(getSavedViewsStorageKey(modelId), JSON.stringify(valid));
  } catch (err) {
    console.warn('Failed to save views to localStorage:', err);
  }
}

export function exportSavedViewsJson(views: SavedView[]): string {
  return JSON.stringify(views.slice(0, MAX_SAVED_VIEWS), null, 2);
}

export function importSavedViewsJson(jsonStr: string): SavedView[] {
  try {
    const parsed = JSON.parse(jsonStr);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.filter(isValidSavedView).slice(0, MAX_SAVED_VIEWS);
  } catch (err) {
    console.warn('Failed to parse saved views JSON:', err);
    return [];
  }
}

export function downloadSavedViewsJson(views: SavedView[], filename = 'jnn-saved-views.json'): void {
  if (typeof window === 'undefined') return;
  const json = exportSavedViewsJson(views);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

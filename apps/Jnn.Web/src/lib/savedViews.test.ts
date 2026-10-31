import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSavedViews,
  saveSavedViews,
  exportSavedViewsJson,
  importSavedViewsJson,
  isValidSavedView,
  MAX_SAVED_VIEWS,
  type SavedView,
} from './savedViews';

describe('savedViews helper', () => {
  const sampleView: SavedView = {
    id: 'view-1',
    name: 'Góc nhìn kiểm tra',
    camera: {
      position: [10, 20, 30],
      target: [0, 0, 0],
      projection: 'perspective',
    },
    section: {
      kind: 'box',
      min: [-5, -5, 0],
      max: [5, 5, 10],
    },
    visibility: {
      hidden: ['el-1', 'el-2'],
      isolated: [],
    },
    xray: true,
    thumbnail: 'data:image/jpeg;base64,1234',
    createdAt: 1700000000000,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('validates a correct SavedView structure', () => {
    expect(isValidSavedView(sampleView)).toBe(true);
    expect(isValidSavedView(null)).toBe(false);
    expect(isValidSavedView({})).toBe(false);
    expect(isValidSavedView({ ...sampleView, camera: null })).toBe(false);
    expect(isValidSavedView({ ...sampleView, visibility: { hidden: 'not-an-array' } })).toBe(false);
  });

  it('saves and loads views from localStorage', () => {
    const modelId = 'test-model-42';
    expect(loadSavedViews(modelId)).toEqual([]);

    saveSavedViews(modelId, [sampleView]);
    const loaded = loadSavedViews(modelId);
    expect(loaded.length).toBe(1);
    expect(loaded[0]!.name).toBe('Góc nhìn kiểm tra');
    expect(loaded[0]!.camera.position).toEqual([10, 20, 30]);
  });

  it('caps saved views at MAX_SAVED_VIEWS (50)', () => {
    const modelId = 'capped-model';
    const manyViews: SavedView[] = [];
    for (let i = 0; i < 60; i++) {
      manyViews.push({
        ...sampleView,
        id: `view-${i}`,
        name: `View ${i}`,
      });
    }

    saveSavedViews(modelId, manyViews);
    const loaded = loadSavedViews(modelId);
    expect(loaded.length).toBe(MAX_SAVED_VIEWS);
    expect(loaded[0]!.id).toBe('view-0');
    expect(loaded[49]!.id).toBe('view-49');
  });

  it('exports and imports valid JSON', () => {
    const json = exportSavedViewsJson([sampleView]);
    expect(typeof json).toBe('string');
    expect(json).toContain('Góc nhìn kiểm tra');

    const imported = importSavedViewsJson(json);
    expect(imported.length).toBe(1);
    expect(imported[0]!.id).toBe('view-1');
    expect(imported[0]!.camera.projection).toBe('perspective');

    // Invalid JSON returns empty array gracefully
    expect(importSavedViewsJson('invalid json string')).toEqual([]);
  });
});

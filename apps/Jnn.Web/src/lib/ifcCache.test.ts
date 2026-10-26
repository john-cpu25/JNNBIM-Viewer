import { describe, it, expect } from 'vitest';
import { computeSha256, isIndexedDBAvailable, getCachedIfcModel, clearIfcCache, getIfcCacheStats } from './ifcCache';

describe('ifcCache', () => {
  it('computes consistent sha256 hex string for Uint8Array', async () => {
    const data1 = new TextEncoder().encode('ISO-10303-21; HEADER; ENDSEC;');
    const hash1 = await computeSha256(data1);
    const hash2 = await computeSha256(data1);

    expect(hash1).toBeDefined();
    expect(hash1.length).toBeGreaterThan(0);
    expect(hash1).toBe(hash2);

    const data2 = new TextEncoder().encode('DIFFERENT IFC CONTENT');
    const hash3 = await computeSha256(data2);
    expect(hash3).not.toBe(hash1);
  });

  it('safely handles environments where IndexedDB may not exist or is stubbed', async () => {
    const available = isIndexedDBAvailable();
    expect(typeof available).toBe('boolean');

    // getCachedIfcModel with empty or non-existent key does not throw
    const res = await getCachedIfcModel('non-existent-sha256');
    expect(res).toBeNull();

    // clearIfcCache does not throw
    const cleared = await clearIfcCache();
    expect(typeof cleared).toBe('boolean');

    // getIfcCacheStats returns valid object
    const stats = await getIfcCacheStats();
    expect(stats).toBeDefined();
    expect(typeof stats.count).toBe('number');
    expect(typeof stats.totalBytes).toBe('number');
    expect(Array.isArray(stats.items)).toBe(true);
  });
});

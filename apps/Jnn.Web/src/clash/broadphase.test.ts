import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  sweepAndPrune,
  bruteForceBroadphase,
  type BoundingBoxItem,
} from './broadphase';

// Deterministic Mulberry32 Pseudo-Random Number Generator
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('clash broadphase sweep-and-prune', () => {
  it('detects 1 candidate pair when two boxes intersect', () => {
    const boxA: BoundingBoxItem = {
      id: 'A1',
      box: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 2, 2)),
    };
    const boxB: BoundingBoxItem = {
      id: 'B1',
      box: new THREE.Box3(new THREE.Vector3(1, 1, 1), new THREE.Vector3(3, 3, 3)),
    };

    const candidates = sweepAndPrune([boxA], [boxB], { tolerance: 0 });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual({ aId: 'A1', bId: 'B1' });
  });

  it('detects 0 candidate pairs when two boxes are far apart', () => {
    const boxA: BoundingBoxItem = {
      id: 'A1',
      box: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)),
    };
    const boxB: BoundingBoxItem = {
      id: 'B1',
      box: new THREE.Box3(new THREE.Vector3(10, 10, 10), new THREE.Vector3(11, 11, 11)),
    };

    const candidates = sweepAndPrune([boxA], [boxB], { tolerance: 0 });
    expect(candidates).toHaveLength(0);
  });

  it('applies tolerance correctly for nearby boxes', () => {
    // Distance between boxes is 0.05m (5cm) along X
    const boxA: BoundingBoxItem = {
      id: 'A1',
      box: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)),
    };
    const boxB: BoundingBoxItem = {
      id: 'B1',
      box: new THREE.Box3(new THREE.Vector3(1.05, 0, 0), new THREE.Vector3(2.05, 1, 1)),
    };

    // Tolerance 0.02m (2cm) -> not overlapping
    const candidatesSmallTol = sweepAndPrune([boxA], [boxB], { tolerance: 0.02 });
    expect(candidatesSmallTol).toHaveLength(0);

    // Tolerance 0.10m (10cm) -> overlapping
    const candidatesLargeTol = sweepAndPrune([boxA], [boxB], { tolerance: 0.10 });
    expect(candidatesLargeTol).toHaveLength(1);
    expect(candidatesLargeTol[0]).toEqual({ aId: 'A1', bId: 'B1' });
  });

  it('handles empty input sets gracefully', () => {
    expect(sweepAndPrune([], [])).toHaveLength(0);
    const boxA: BoundingBoxItem = {
      id: 'A1',
      box: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)),
    };
    expect(sweepAndPrune([boxA], [])).toHaveLength(0);
    expect(sweepAndPrune([], [boxA])).toHaveLength(0);
  });

  it('matches brute-force exactly for 1,000 random boxes with fixed seed', () => {
    const rng = mulberry32(133742);

    const generateRandomBoxes = (count: number, prefix: string): BoundingBoxItem[] => {
      const items: BoundingBoxItem[] = [];
      for (let i = 0; i < count; i++) {
        // Spread boxes in a 100 x 100 x 50 volume
        const x = rng() * 100;
        const y = rng() * 100;
        const z = rng() * 50;

        const sx = 0.5 + rng() * 4.5;
        const sy = 0.5 + rng() * 4.5;
        const sz = 0.5 + rng() * 4.5;

        items.push({
          id: `${prefix}_${i}`,
          box: new THREE.Box3(
            new THREE.Vector3(x, y, z),
            new THREE.Vector3(x + sx, y + sy, z + sz),
          ),
        });
      }
      return items;
    };

    // Generate 500 boxes for set A and 500 boxes for set B (total 1,000 boxes)
    const setA = generateRandomBoxes(500, 'A');
    const setB = generateRandomBoxes(500, 'B');
    const tolerance = 0.05; // 5cm

    const tStartSAP = performance.now();
    const sapResults = sweepAndPrune(setA, setB, { tolerance });
    const sapDuration = performance.now() - tStartSAP;

    const tStartBF = performance.now();
    const bfResults = bruteForceBroadphase(setA, setB, { tolerance });
    const bfDuration = performance.now() - tStartBF;

    // Sort pair lists canonically to compare equality
    const toCanonicalKey = (p: { aId: string | number; bId: string | number }) => `${p.aId}:::${p.bId}`;
    const sapKeys = sapResults.map(toCanonicalKey).sort();
    const bfKeys = bfResults.map(toCanonicalKey).sort();

    expect(sapKeys.length).toBeGreaterThan(0);
    expect(sapKeys).toEqual(bfKeys);

    // Performance assertion: sweep-and-prune should be noticeably faster than brute-force on 250,000 pairs
    console.log(`[Broadphase Benchmark 1000 boxes] SAP: ${sapDuration.toFixed(2)}ms vs BF: ${bfDuration.toFixed(2)}ms | Overlapping pairs: ${sapKeys.length}`);
    expect(sapDuration).toBeLessThanOrEqual(bfDuration + 5); // Allow small margin on fast runs
  });
});

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  axisDragParam,
  boxForStorey,
  clampBox,
  planeFromHit,
  snapValue,
} from './sectionMath';
import type { Bounds, Vec3 } from './ViewerAdapter';

describe('sectionMath', () => {
  describe('axisDragParam', () => {
    it('computes parameter t along axis perpendicular to view direction', () => {
      // Ray from (0, 0, 10) in direction (0, 0, -1)
      const o = new THREE.Vector3(0, 0, 10);
      const r = new THREE.Vector3(0, 0, -1);
      // Axis along X through p0 = (0, 0, 0)
      const p0 = new THREE.Vector3(0, 0, 0);
      const d = new THREE.Vector3(1, 0, 0);

      const t = axisDragParam(o, r, p0, d);
      expect(t).not.toBeNull();
      expect(t).toBeCloseTo(0, 4);

      // Ray offset by 3 units along X: (3, 0, 10) -> (3, 0, -1)
      const oOffset = new THREE.Vector3(3, 0, 10);
      const tOffset = axisDragParam(oOffset, r, p0, d);
      expect(tOffset).not.toBeNull();
      expect(tOffset).toBeCloseTo(3, 4);
    });

    it('returns null when axis is nearly parallel to view ray', () => {
      const o = new THREE.Vector3(0, 0, 10);
      const r = new THREE.Vector3(0, 0, -1);
      const p0 = new THREE.Vector3(0, 0, 0);
      const d = new THREE.Vector3(0, 0, 1); // parallel to ray

      expect(axisDragParam(o, r, p0, d)).toBeNull();
    });
  });

  describe('snapValue', () => {
    it('snaps to specified step', () => {
      expect(snapValue(1.234, 0.1)).toBeCloseTo(1.2, 4);
      expect(snapValue(1.267, 0.1)).toBeCloseTo(1.3, 4);
      expect(snapValue(1.234, 0.01)).toBeCloseTo(1.23, 4);
      expect(snapValue(1.234, 0)).toBe(1.234);
    });
  });

  describe('clampBox', () => {
    const limits: Bounds = { min: [-10, -10, 0], max: [10, 10, 10] };
    const min: Vec3 = [0, 0, 0];
    const max: Vec3 = [5, 5, 5];

    it('clamps min value to avoid min >= max and limits - 10', () => {
      // Trying to move min X above max X - 0.1
      expect(clampBox(min, max, 0, 'min', 5.5, limits)).toBeCloseTo(4.9, 4);
      // Trying to move min X far below limits.min[0] - 10 (-20)
      expect(clampBox(min, max, 0, 'min', -25, limits)).toBeCloseTo(-20, 4);
      // Normal valid min value
      expect(clampBox(min, max, 0, 'min', 2, limits)).toBe(2);
    });

    it('clamps max value to avoid max <= min and limits + 10', () => {
      // Trying to move max X below min X + 0.1
      expect(clampBox(min, max, 0, 'max', -1, limits)).toBeCloseTo(0.1, 4);
      // Trying to move max X far above limits.max[0] + 10 (20)
      expect(clampBox(min, max, 0, 'max', 25, limits)).toBeCloseTo(20, 4);
      // Normal valid max value
      expect(clampBox(min, max, 0, 'max', 4, limits)).toBe(4);
    });
  });

  describe('planeFromHit', () => {
    const hitPoint: Vec3 = [3, 4, 2];
    const viewDir: Vec3 = [0, -1, 0];

    it('determines axis and flipped state for 6 cardinal normals', () => {
      // +X
      expect(planeFromHit(hitPoint, [1, 0, 0], viewDir)).toEqual({
        axis: 'x',
        offset: 3,
        flipped: false,
      });
      // -X
      expect(planeFromHit(hitPoint, [-1, 0, 0], viewDir)).toEqual({
        axis: 'x',
        offset: 3,
        flipped: true,
      });
      // +Y
      expect(planeFromHit(hitPoint, [0, 1, 0], viewDir)).toEqual({
        axis: 'y',
        offset: 4,
        flipped: false,
      });
      // -Y
      expect(planeFromHit(hitPoint, [0, -1, 0], viewDir)).toEqual({
        axis: 'y',
        offset: 4,
        flipped: true,
      });
      // +Z
      expect(planeFromHit(hitPoint, [0, 0, 1], viewDir)).toEqual({
        axis: 'z',
        offset: 2,
        flipped: false,
      });
      // -Z
      expect(planeFromHit(hitPoint, [0, 0, -1], viewDir)).toEqual({
        axis: 'z',
        offset: 2,
        flipped: true,
      });
    });

    it('falls back to view direction when normal is null', () => {
      // viewDir = [0, -1, 0] -> normal fallback = [0, 1, 0] -> axis Y, flipped false
      expect(planeFromHit(hitPoint, null, [0, -1, 0])).toEqual({
        axis: 'y',
        offset: 4,
        flipped: false,
      });
    });
  });

  describe('boxForStorey', () => {
    const storeys = [
      { elevation: 0.0, name: 'Tầng 1' },
      { elevation: 3.6, name: 'Tầng 2' },
      { elevation: 7.2, name: 'Tầng 3' },
    ];
    const current = { min: [-5, -5, 0] as Vec3, max: [5, 5, 10] as Vec3 };
    const bounds: Bounds = { min: [-10, -10, 0], max: [10, 10, 9] };

    it('fits middle storey', () => {
      // Index 1 = Tầng 2 (3.6m to 7.2m)
      const res = boxForStorey(storeys, 1, current, bounds);
      expect(res.min[2]).toBeCloseTo(3.55, 4); // 3.6 - 0.05
      expect(res.max[2]).toBeCloseTo(7.15, 4); // 7.2 - 0.05
      expect(res.min[0]).toBe(-5);
      expect(res.max[1]).toBe(5);
    });

    it('fits top storey using model bounds + 0.5m', () => {
      // Index 2 = Tầng 3 (7.2m to bounds.max[2] + 0.5 = 9.5m)
      const res = boxForStorey(storeys, 2, current, bounds);
      expect(res.min[2]).toBeCloseTo(7.15, 4);
      expect(res.max[2]).toBeCloseTo(9.5, 4);
    });
  });
});

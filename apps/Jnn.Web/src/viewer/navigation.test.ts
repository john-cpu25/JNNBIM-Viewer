import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import CameraControls from 'camera-controls';
import {
  baseMapping,
  intentOnDown,
  orbitMapping,
  shouldUseHoverCache,
  worldUnitsPerPixel,
} from './navigation';

const A = CameraControls.ACTION;

describe('navigation mappings & intent', () => {
  it('derives base mapping for revit preset', () => {
    const persp = baseMapping('revit', false);
    expect(persp.left).toBe(A.NONE);
    expect(persp.middle).toBe(A.TRUCK);
    expect(persp.right).toBe(A.TRUCK);
    expect(persp.wheel).toBe(A.DOLLY);

    const ortho = baseMapping('revit', true);
    expect(ortho.wheel).toBe(A.ZOOM);
  });

  it('derives base mapping for classic preset', () => {
    const persp = baseMapping('classic', false);
    expect(persp.left).toBe(A.ROTATE);
    expect(persp.middle).toBe(A.TRUCK);
    expect(persp.right).toBe(A.TRUCK);
  });

  it('enables rotate on orbit mapping', () => {
    const base = baseMapping('revit', false);
    const mapped = orbitMapping(base);
    expect(mapped.left).toBe(A.ROTATE);
    expect(mapped.middle).toBe(A.ROTATE);
  });

  it('detects intent on pointerdown for revit preset', () => {
    // Shift + Left click -> orbit-pending
    expect(intentOnDown('revit', 0, true)).toBe('orbit-pending');
    // Shift + Middle click -> orbit-pending
    expect(intentOnDown('revit', 1, true)).toBe('orbit-pending');
    // Normal Left click -> none (reserved for select)
    expect(intentOnDown('revit', 0, false)).toBe('none');
    // Middle click -> pan
    expect(intentOnDown('revit', 1, false)).toBe('pan');
    // Right click -> pan
    expect(intentOnDown('revit', 2, false)).toBe('pan');
  });

  it('detects intent on pointerdown for classic preset', () => {
    // Left click -> orbit-pending
    expect(intentOnDown('classic', 0, false)).toBe('orbit-pending');
    // Middle click -> pan
    expect(intentOnDown('classic', 1, false)).toBe('pan');
  });
});

describe('worldUnitsPerPixel', () => {
  it('calculates screen-space units for perspective camera', () => {
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    const dist = 10;
    const h = 600;
    const wupp = worldUnitsPerPixel(cam, dist, h);
    // 2 * 10 * tan(30deg) / 600 = 20 * 0.57735 / 600 = 0.019245
    expect(wupp).toBeCloseTo(0.019245, 4);
  });

  it('calculates screen-space units for orthographic camera', () => {
    const cam = new THREE.OrthographicCamera(-10, 10, 20, -20, 0.1, 1000);
    cam.zoom = 2;
    const h = 400;
    const wupp = worldUnitsPerPixel(cam, 50, h);
    // (top - bottom) / zoom / h = (20 - (-20)) / 2 / 400 = 40 / 800 = 0.05
    expect(wupp).toBeCloseTo(0.05, 4);
  });
});

describe('shouldUseHoverCache', () => {
  it('accepts cache if fresh (< 150ms) and close (< 4px)', () => {
    const cache = {
      x: 100,
      y: 100,
      t: 1000,
      point: new THREE.Vector3(1, 2, 3),
    };
    expect(shouldUseHoverCache(cache, 102, 101, 1100)).toBe(true);
    // Too old
    expect(shouldUseHoverCache(cache, 102, 101, 1200)).toBe(false);
    // Too far
    expect(shouldUseHoverCache(cache, 110, 100, 1050)).toBe(false);
    // Null cache
    expect(shouldUseHoverCache(null, 100, 100, 1050)).toBe(false);
  });
});

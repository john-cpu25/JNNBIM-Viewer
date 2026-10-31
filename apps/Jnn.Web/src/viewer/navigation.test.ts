import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import CameraControls from 'camera-controls';
import {
  baseMapping,
  choosePivot,
  intentOnDown,
  orbitMapping,
  shouldReanchorOnShift,
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

describe('choosePivot (F2)', () => {
  const modelBounds = new THREE.Box3(new THREE.Vector3(-10, -5, -20), new THREE.Vector3(10, 5, 20));
  // Center is (0, 0, 0), size is (20, 10, 40)
  // 10% margin expands by: x +/- 2, y +/- 1, z +/- 4
  // Expanded box: [-12, -6, -24] to [12, 6, 24]

  it('returns planePoint when bounds is null', () => {
    const pt = new THREE.Vector3(50, 50, 50);
    const res = choosePivot(pt, null);
    expect(res.equals(pt)).toBe(true);
  });

  it('returns planePoint when bounds is empty', () => {
    const pt = new THREE.Vector3(50, 50, 50);
    const empty = new THREE.Box3();
    const res = choosePivot(pt, empty);
    expect(res.equals(pt)).toBe(true);
  });

  it('returns planePoint when point is inside model bounds', () => {
    const pt = new THREE.Vector3(2, 1, 5);
    const res = choosePivot(pt, modelBounds);
    expect(res.equals(pt)).toBe(true);
  });

  it('returns planePoint when point is within 10% margin', () => {
    // x = 11 is outside original [ -10, 10 ], but within expanded [ -12, 12 ]
    const pt = new THREE.Vector3(11, 0, 0);
    const res = choosePivot(pt, modelBounds);
    expect(res.equals(pt)).toBe(true);
  });

  it('falls back to model center when point lands outside model bounds', () => {
    // x = 50 is far outside model bounds
    const pt = new THREE.Vector3(50, 0, 0);
    const res = choosePivot(pt, modelBounds);
    expect(res.x).toBeCloseTo(0);
    expect(res.y).toBeCloseTo(0);
    expect(res.z).toBeCloseTo(0);
  });
});

describe('shouldReanchorOnShift (Hotfix 2 - F1)', () => {
  it('rejects auto-repeated keydown events', () => {
    expect(shouldReanchorOnShift(true, { button: 1, intent: 'pan' })).toBe(false);
  });

  it('rejects when there is no active gesture', () => {
    expect(shouldReanchorOnShift(false, null)).toBe(false);
  });

  it('rejects when gesture is already orbiting', () => {
    expect(shouldReanchorOnShift(false, { button: 0, intent: 'orbit' })).toBe(false);
    expect(shouldReanchorOnShift(false, { button: 1, intent: 'orbit' })).toBe(false);
  });

  it('rejects when gesture is orbit-pending (Shift already down at pointerdown)', () => {
    expect(shouldReanchorOnShift(false, { button: 0, intent: 'orbit-pending' })).toBe(false);
    expect(shouldReanchorOnShift(false, { button: 1, intent: 'orbit-pending' })).toBe(false);
  });

  it('rejects right-click gesture (button 2)', () => {
    expect(shouldReanchorOnShift(false, { button: 2, intent: 'pan' })).toBe(false);
  });

  it('accepts middle-mouse pan gesture when pressing Shift (switching pan -> orbit)', () => {
    expect(shouldReanchorOnShift(false, { button: 1, intent: 'pan' })).toBe(true);
  });

  it('accepts left-click idle gesture in revit mode when pressing Shift', () => {
    expect(shouldReanchorOnShift(false, { button: 0, intent: 'none' })).toBe(true);
  });
});

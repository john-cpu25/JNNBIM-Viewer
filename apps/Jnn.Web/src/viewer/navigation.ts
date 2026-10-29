import * as THREE from 'three';
import CameraControls from 'camera-controls';
import type { NavigationPreset } from './ViewerAdapter';

const A = CameraControls.ACTION;

export type MouseButtonAction =
  | typeof A.ROTATE
  | typeof A.TRUCK
  | typeof A.SCREEN_PAN
  | typeof A.OFFSET
  | typeof A.DOLLY
  | typeof A.ZOOM
  | typeof A.NONE;

export type MouseWheelAction = MouseButtonAction;

export interface MouseMapping {
  left: MouseButtonAction;
  middle: MouseButtonAction;
  right: MouseButtonAction;
  wheel: MouseWheelAction;
}

/** Sơ đồ nền (khi không trong gesture xoay). */
export function baseMapping(preset: NavigationPreset, ortho: boolean): MouseMapping {
  const wheel = ortho ? A.ZOOM : A.DOLLY;
  return preset === 'revit'
    ? { left: A.NONE, middle: A.TRUCK, right: A.TRUCK, wheel }
    : { left: A.ROTATE, middle: A.TRUCK, right: A.TRUCK, wheel };
}

/** Sơ đồ khi gesture xoay đã vượt ngưỡng. */
export function orbitMapping(base: MouseMapping): MouseMapping {
  return { ...base, left: A.ROTATE, middle: A.ROTATE };
}

export type GestureIntent = 'orbit-pending' | 'orbit' | 'pan' | 'none';

/** Xác định ý định từ nút + Shift ở thời điểm pointerdown. */
export function intentOnDown(preset: NavigationPreset, button: number, shift: boolean): GestureIntent {
  if (shift && (button === 0 || button === 1)) return 'orbit-pending';
  if (button === 0) return preset === 'classic' ? 'orbit-pending' : 'none';
  if (button === 1 || button === 2) return 'pan';
  return 'none';
}

export const DRAG_THRESHOLD_PX = 4;

/**
 * Calculates world units represented by a single pixel on screen.
 * Used to keep gizmos and indicators a fixed screen-space pixel size.
 */
export function worldUnitsPerPixel(camera: THREE.Camera, distance: number, viewportHeightPx: number): number {
  if (viewportHeightPx <= 0) return 0.001;
  const cam = camera as any;
  if (cam.isPerspectiveCamera) {
    return (2 * distance * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / viewportHeightPx;
  }
  if (cam.isOrthographicCamera) {
    return (cam.top - cam.bottom) / (cam.zoom || 1) / viewportHeightPx;
  }
  return 0.001;
}

export interface HoverCache {
  x: number;
  y: number;
  t: number;
  point: THREE.Vector3;
}

/** Determines whether the cached hover point can be reused as the orbit pivot. */
export function shouldUseHoverCache(
  cache: HoverCache | null,
  clientX: number,
  clientY: number,
  now: number,
  maxAgeMs = 150,
  maxDistPx = 4,
): boolean {
  if (!cache) return false;
  if (now - cache.t >= maxAgeMs) return false;
  return Math.hypot(cache.x - clientX, cache.y - clientY) < maxDistPx;
}

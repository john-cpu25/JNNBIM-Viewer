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

export type GestureIntent = 'orbit-pending' | 'orbit' | 'pan' | 'box-select' | 'none';

export type BoxSelectMode = 'window' | 'crossing';

export function boxSelectMode(
  start: { x: number; y: number },
  end: { x: number; y: number },
): BoxSelectMode {
  return start.x <= end.x ? 'window' : 'crossing';
}

export interface NormalizedRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  mode: BoxSelectMode;
}

export function normalizeRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
): NormalizedRect {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    mode: start.x <= end.x ? 'window' : 'crossing',
  };
}

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

/**
 * Chooses the orbit pivot point when clicking into empty space.
 * If planePoint falls outside the visible model bounds (expanded with margin),
 * falls back to the center of the bounding box to avoid wild camera swings.
 */
export function choosePivot(
  planePoint: THREE.Vector3,
  bounds: THREE.Box3 | null,
  marginRatio = 0.1,
): THREE.Vector3 {
  if (!bounds || bounds.isEmpty()) {
    return planePoint.clone();
  }
  const size = bounds.getSize(new THREE.Vector3());
  const margin = size.clone().multiplyScalar(marginRatio);
  const expanded = bounds.clone();
  expanded.min.sub(margin);
  expanded.max.add(margin);

  if (expanded.containsPoint(planePoint)) {
    return planePoint.clone();
  }

  const center = new THREE.Vector3();
  bounds.getCenter(center);
  return center;
}

/**
 * Determines whether a Shift keydown event should re-anchor the pivot and switch to orbit.
 * - Ignores auto-repeated keydown events (ev.repeat === true).
 * - Ignores if no gesture is active or if not using mouse button 0 or 1.
 * - Ignores if gesture is already orbiting ('orbit' or 'orbit-pending').
 * - Only triggers when currently panning (e.g. middle-mouse drag in Revit mode).
 */
export function shouldReanchorOnShift(
  repeat: boolean,
  gesture: { button: number; intent: GestureIntent } | null,
): boolean {
  if (repeat || !gesture) return false;
  if (gesture.button !== 0 && gesture.button !== 1) return false;
  if (gesture.intent === 'orbit' || gesture.intent === 'orbit-pending') return false;
  return true;
}

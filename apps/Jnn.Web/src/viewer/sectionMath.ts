import * as THREE from 'three';
import type { Bounds, SectionAxis, Vec3 } from './ViewerAdapter';

/**
 * Calculates parameter t along a 3D axis closest to the mouse ray.
 *
 * @param o Origin of the ray (Three.js coordinates)
 * @param r Normalized direction of the ray (Three.js coordinates)
 * @param p0 Handle point on the axis (Three.js coordinates)
 * @param d Normalized direction of the axis (Three.js coordinates)
 * @returns t in units along d, or null if axis is nearly parallel to view ray
 */
export function axisDragParam(
  o: THREE.Vector3,
  r: THREE.Vector3,
  p0: THREE.Vector3,
  d: THREE.Vector3,
): number | null {
  const w0 = p0.clone().sub(o);
  const b = d.dot(r);
  const denom = 1 - b * b;
  if (Math.abs(denom) < 1e-3) return null; // Axis nearly parallel to ray
  const dw = d.dot(w0);
  const rw = r.dot(w0);
  return (b * rw - dw) / denom;
}

export function snapValue(v: number, step: number): number {
  if (step <= 0) return v;
  return Math.round(v / step) * step;
}

export function clampBox(
  min: Vec3,
  max: Vec3,
  axis: 0 | 1 | 2,
  side: 'min' | 'max',
  value: number,
  limits: Bounds,
  minSize = 0.1,
): number {
  const lo = limits.min[axis] - 10;
  const hi = limits.max[axis] + 10;
  return side === 'min'
    ? Math.min(Math.max(value, lo), max[axis] - minSize)
    : Math.max(Math.min(value, hi), min[axis] + minSize);
}

export function planeFromHit(
  point: Vec3,
  normal: Vec3 | null,
  viewDir: Vec3,
): { axis: SectionAxis; offset: number; flipped: boolean } {
  let n = normal;
  if (!n || (Math.abs(n[0]) < 1e-4 && Math.abs(n[1]) < 1e-4 && Math.abs(n[2]) < 1e-4)) {
    // Fallback: plane facing opposite of camera view direction
    n = [-viewDir[0], -viewDir[1], -viewDir[2]];
  }

  const absX = Math.abs(n[0]);
  const absY = Math.abs(n[1]);
  const absZ = Math.abs(n[2]);

  let axis: SectionAxis = 'z';
  let maxComponent = absZ;
  if (absX >= maxComponent && absX >= absY) {
    axis = 'x';
    maxComponent = absX;
  } else if (absY >= maxComponent) {
    axis = 'y';
  }

  const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const offset = snapValue(point[axisIdx], 0.01);
  const flipped = n[axisIdx] < 0;

  return { axis, offset, flipped };
}

export function boxForStorey(
  storeys: { elevation: number; name?: string }[],
  index: number,
  current: { min: Vec3; max: Vec3 },
  bounds: Bounds,
): { min: Vec3; max: Vec3 } {
  if (storeys.length === 0 || index < 0 || index >= storeys.length) return current;
  const sorted = [...storeys].sort((a, b) => a.elevation - b.elevation);
  const curStorey = sorted[index]!;
  const nextStorey = sorted[index + 1];

  const zMin = curStorey.elevation - 0.05;
  const zMax = nextStorey ? nextStorey.elevation - 0.05 : bounds.max[2] + 0.5;

  return {
    min: [current.min[0], current.min[1], zMin],
    max: [current.max[0], current.max[1], zMax],
  };
}

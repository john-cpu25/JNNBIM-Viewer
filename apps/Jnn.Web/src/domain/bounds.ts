/**
 * Lightweight AABB helpers in model coordinates (+Z up).
 * Used by the UI for fit-to-view, section ranges and selection summaries.
 * Heavy geometry work (BVH, clash, section polylines) belongs to the native
 * Jnn.Geometry.Core library (Milestone 3), not here.
 */
import type { Bounds, Vec3 } from '../viewer/ViewerAdapter';
import type { JnnElement, Transform } from './model';

export function applyTransform(m: Transform, p: Vec3): Vec3 {
  const [x, y, z] = p;
  return [
    m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
    m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
    m[2]! * x + m[6]! * y + m[10]! * z + m[14]!,
  ];
}

export function emptyBounds(): Bounds {
  return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
}

export function isEmpty(b: Bounds): boolean {
  return b.min[0] > b.max[0] || b.min[1] > b.max[1] || b.min[2] > b.max[2];
}

export function expandByPoint(b: Bounds, p: Vec3): Bounds {
  return {
    min: [Math.min(b.min[0], p[0]), Math.min(b.min[1], p[1]), Math.min(b.min[2], p[2])],
    max: [Math.max(b.max[0], p[0]), Math.max(b.max[1], p[1]), Math.max(b.max[2], p[2])],
  };
}

export function union(a: Bounds, b: Bounds): Bounds {
  return expandByPoint(expandByPoint(a, b.min), b.max);
}

export function center(b: Bounds): Vec3 {
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
}

export function size(b: Bounds): Vec3 {
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
}

export function pad(b: Bounds, d: number): Bounds {
  return {
    min: [b.min[0] - d, b.min[1] - d, b.min[2] - d],
    max: [b.max[0] + d, b.max[1] + d, b.max[2] + d],
  };
}

/** World AABB of an element from its box primitives and placement transform. */
export function elementBounds(el: JnnElement): Bounds {
  let b = emptyBounds();
  for (const ref of el.meshRefs) {
    const p = ref.primitive;
    if (!p) continue;
    const [sx, sy, sz] = p.size;
    const c = Math.cos(p.rotationZ);
    const s = Math.sin(p.rotationZ);
    for (const dx of [-0.5, 0.5])
      for (const dy of [-0.5, 0.5])
        for (const dz of [-0.5, 0.5]) {
          const lx = dx * sx;
          const ly = dy * sy;
          const local: Vec3 = [p.center[0] + lx * c - ly * s, p.center[1] + lx * s + ly * c, p.center[2] + dz * sz];
          b = expandByPoint(b, applyTransform(el.transform, local));
        }
  }
  return b;
}

export function boundsOf(elements: Iterable<JnnElement>): Bounds {
  let b = emptyBounds();
  for (const e of elements) {
    const eb = elementBounds(e);
    if (!isEmpty(eb)) b = union(b, eb);
  }
  return b;
}

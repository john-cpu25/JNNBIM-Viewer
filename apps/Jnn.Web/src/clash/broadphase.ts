import * as THREE from 'three';

export interface BoundingBoxItem {
  id: string | number;
  box: THREE.Box3;
}

export interface CandidatePair {
  aId: string | number;
  bId: string | number;
}

export interface BroadphaseOptions {
  tolerance?: number;
  ignoreSameElement?: boolean;
}

/**
 * Sweeps along the X-axis and prunes candidate overlapping pairs between two sets of bounding boxes.
 * Bounding boxes are expanded by tolerance in all 3 axes.
 *
 * Employs Sweep-and-Prune with a monotonic lower-bound binary search:
 * Given max width W_B of boxes in set B, any box B satisfying maxB.x >= minA.x - tolerance
 * must have minB.x >= minA.x - tolerance - W_B.
 * This guarantees O(log N) entry point and O(K) pruning without missing any overlapping pair.
 */
export function sweepAndPrune(
  setA: BoundingBoxItem[],
  setB: BoundingBoxItem[],
  options?: BroadphaseOptions,
): CandidatePair[] {
  const tolerance = Math.max(0, options?.tolerance ?? 0);
  const ignoreSame = options?.ignoreSameElement ?? true;

  if (setA.length === 0 || setB.length === 0) {
    return [];
  }

  // Pre-filter valid non-empty boxes
  const validA = setA.filter((item) => item.box && !item.box.isEmpty());
  const validB = setB.filter((item) => item.box && !item.box.isEmpty());

  if (validA.length === 0 || validB.length === 0) {
    return [];
  }

  // Sort setB by min.x once
  const sortedB = [...validB].sort((a, b) => a.box.min.x - b.box.min.x);

  // Maximum extent along X for elements in B
  let maxBWidth = 0;
  for (const item of sortedB) {
    const w = item.box.max.x - item.box.min.x;
    if (w > maxBWidth) maxBWidth = w;
  }

  const candidates: CandidatePair[] = [];
  const seenPairs = new Set<string>();

  for (const itemA of validA) {
    const boxA = itemA.box;
    const minAx = boxA.min.x - tolerance;
    const maxAx = boxA.max.x + tolerance;
    const minAy = boxA.min.y - tolerance;
    const maxAy = boxA.max.y + tolerance;
    const minAz = boxA.min.z - tolerance;
    const maxAz = boxA.max.z + tolerance;

    // Any candidate box B must satisfy: minB.x >= minAx - maxBWidth
    const searchCutoffX = minAx - maxBWidth;

    let low = 0;
    let high = sortedB.length - 1;
    let startIndex = sortedB.length;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (sortedB[mid]!.box.min.x >= searchCutoffX) {
        startIndex = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    // Sweep forward through B from startIndex
    for (let j = startIndex; j < sortedB.length; j++) {
      const itemB = sortedB[j]!;
      const boxB = itemB.box;

      // X-axis pruning condition: if B's min.x exceeds A's maxAx, no subsequent elements in B can overlap
      if (boxB.min.x > maxAx) {
        break;
      }

      // Check lower X boundary
      if (boxB.max.x < minAx) {
        continue;
      }

      // Y-axis overlap check
      if (boxB.max.y < minAy || boxB.min.y > maxAy) {
        continue;
      }

      // Z-axis overlap check
      if (boxB.max.z < minAz || boxB.min.z > maxAz) {
        continue;
      }

      // Ignore identical element if configured
      if (ignoreSame && itemA.id === itemB.id) {
        continue;
      }

      // Canonical pair deduplication
      const pairKey = `${itemA.id}:::${itemB.id}`;
      if (!seenPairs.has(pairKey)) {
        seenPairs.add(pairKey);
        candidates.push({ aId: itemA.id, bId: itemB.id });
      }
    }
  }

  return candidates;
}

/**
 * Reference O(N*M) brute-force broadphase implementation used for validation testing.
 */
export function bruteForceBroadphase(
  setA: BoundingBoxItem[],
  setB: BoundingBoxItem[],
  options?: BroadphaseOptions,
): CandidatePair[] {
  const tolerance = Math.max(0, options?.tolerance ?? 0);
  const ignoreSame = options?.ignoreSameElement ?? true;
  const candidates: CandidatePair[] = [];
  const seenPairs = new Set<string>();

  for (const itemA of setA) {
    if (!itemA.box || itemA.box.isEmpty()) continue;
    const a = itemA.box;

    for (const itemB of setB) {
      if (!itemB.box || itemB.box.isEmpty()) continue;
      if (ignoreSame && itemA.id === itemB.id) continue;

      const b = itemB.box;

      const overlapX = a.min.x - tolerance <= b.max.x && b.min.x - tolerance <= a.max.x;
      const overlapY = a.min.y - tolerance <= b.max.y && b.min.y - tolerance <= a.max.y;
      const overlapZ = a.min.z - tolerance <= b.max.z && b.min.z - tolerance <= a.max.z;

      if (overlapX && overlapY && overlapZ) {
        const key = `${itemA.id}:::${itemB.id}`;
        if (!seenPairs.has(key)) {
          seenPairs.add(key);
          candidates.push({ aId: itemA.id, bId: itemB.id });
        }
      }
    }
  }

  return candidates;
}


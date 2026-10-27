import * as THREE from 'three';
import { MeshBVH, type MeshBVHOptions } from 'three-mesh-bvh';

export type ClashType = 'Hard' | 'Clearance' | 'Duplicates';

export interface NarrowphaseElement {
  id: string | number;
  guid?: string;
  ifcClass?: string;
  box: THREE.Box3;
  geometry: THREE.BufferGeometry;
  bvh?: MeshBVH;
  triangleCount?: number;
}

export interface ClashResult {
  clashId: string;
  testId: string;
  aId: string | number;
  bId: string | number;
  aGuid?: string;
  bGuid?: string;
  type: ClashType;
  distance: number; // 0 for Hard and Duplicates; > 0 for Clearance
  point: [number, number, number];
  boxOverlap: {
    min: [number, number, number];
    max: [number, number, number];
  };
}

const IDENTITY_MATRIX = new THREE.Matrix4();

/**
 * Generates a stable deterministic clash ID based on testId and the sorted pair of element GUIDs/IDs.
 */
export function generateClashId(
  testId: string,
  aGuidOrId: string | number,
  bGuidOrId: string | number,
): string {
  const strA = String(aGuidOrId);
  const strB = String(bGuidOrId);
  const [first, second] = strA < strB ? [strA, strB] : [strB, strA];
  const key = `${testId}:::${first}:::${second}`;

  // 32-bit FNV-1a hash
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `clash_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Helper to ensure an element has a built MeshBVH.
 */
export function ensureBVH(element: NarrowphaseElement, options?: MeshBVHOptions): MeshBVH {
  if (!element.bvh) {
    element.bvh = new MeshBVH(element.geometry, options);
  }
  return element.bvh;
}

/**
 * Evaluates narrow-phase clash between two elements for a specified clash type and tolerance.
 */
export function checkNarrowphasePair(
  elA: NarrowphaseElement,
  elB: NarrowphaseElement,
  type: ClashType,
  tolerance = 0,
  testId = 'default_test',
  matrixBtoA: THREE.Matrix4 = IDENTITY_MATRIX,
): ClashResult | null {
  const aKey = elA.guid ?? elA.id;
  const bKey = elB.guid ?? elB.id;
  const clashId = generateClashId(testId, aKey, bKey);

  const overlapBox = elA.box.clone().intersect(elB.box);
  const boxOverlap = {
    min: [
      overlapBox.isEmpty() ? elA.box.min.x : overlapBox.min.x,
      overlapBox.isEmpty() ? elA.box.min.y : overlapBox.min.y,
      overlapBox.isEmpty() ? elA.box.min.z : overlapBox.min.z,
    ] as [number, number, number],
    max: [
      overlapBox.isEmpty() ? elA.box.max.x : overlapBox.max.x,
      overlapBox.isEmpty() ? elA.box.max.y : overlapBox.max.y,
      overlapBox.isEmpty() ? elA.box.max.z : overlapBox.max.z,
    ] as [number, number, number],
  };

  // 1. DUPLICATES DETECTION
  if (type === 'Duplicates') {
    // Must belong to the same IFC class if class is specified
    if (elA.ifcClass && elB.ifcClass && elA.ifcClass !== elB.ifcClass) {
      return null;
    }

    // Must have identical triangle count if specified
    const posA = elA.geometry.getAttribute('position');
    const posB = elB.geometry.getAttribute('position');
    const triA = elA.triangleCount ?? (elA.geometry.index ? Math.floor(elA.geometry.index.count / 3) : (posA ? Math.floor(posA.count / 3) : 0));
    const triB = elB.triangleCount ?? (elB.geometry.index ? Math.floor(elB.geometry.index.count / 3) : (posB ? Math.floor(posB.count / 3) : 0));
    if (triA !== triB) {
      return null;
    }

    // Bounding boxes must coincide within tolerance
    const minDiff = elA.box.min.distanceTo(elB.box.min);
    const maxDiff = elA.box.max.distanceTo(elB.box.max);
    if (minDiff <= tolerance && maxDiff <= tolerance) {
      const center = new THREE.Vector3();
      elA.box.getCenter(center);
      return {
        clashId,
        testId,
        aId: elA.id,
        bId: elB.id,
        aGuid: elA.guid,
        bGuid: elB.guid,
        type: 'Duplicates',
        distance: 0,
        point: [center.x, center.y, center.z],
        boxOverlap,
      };
    }
    return null;
  }

  // Ensure BVH exists on element A
  const bvhA = ensureBVH(elA);

  // Check triangle intersection (Hard clash or touching faces)
  const isIntersecting = Boolean(bvhA.intersectsGeometry(elB.geometry, matrixBtoA));

  // 2. HARD CLASH DETECTION
  if (type === 'Hard') {
    if (isIntersecting) {
      const center = new THREE.Vector3();
      if (!overlapBox.isEmpty()) {
        overlapBox.getCenter(center);
      } else {
        const centerA = elA.box.getCenter(new THREE.Vector3());
        const centerB = elB.box.getCenter(new THREE.Vector3());
        center.addVectors(centerA, centerB).multiplyScalar(0.5);
      }

      return {
        clashId,
        testId,
        aId: elA.id,
        bId: elB.id,
        aGuid: elA.guid,
        bGuid: elB.guid,
        type: 'Hard',
        distance: 0,
        point: [center.x, center.y, center.z],
        boxOverlap,
      };
    }
    return null;
  }

  // 3. CLEARANCE DETECTION
  if (type === 'Clearance') {
    // If meshes intersect physically, it is a Hard intersection, not clearance
    if (isIntersecting) {
      return null;
    }

    const res = bvhA.closestPointToGeometry(elB.geometry, matrixBtoA);
    if (res && res.distance > 0 && res.distance < tolerance) {
      const pt = res.point;
      return {
        clashId,
        testId,
        aId: elA.id,
        bId: elB.id,
        aGuid: elA.guid,
        bGuid: elB.guid,
        type: 'Clearance',
        distance: res.distance,
        point: [pt.x, pt.y, pt.z],
        boxOverlap,
      };
    }
    return null;
  }

  return null;
}

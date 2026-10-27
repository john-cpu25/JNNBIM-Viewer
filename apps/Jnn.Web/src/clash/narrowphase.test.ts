import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  checkNarrowphasePair,
  generateClashId,
  type NarrowphaseElement,
} from './narrowphase';
import { createBufferGeometry, createMeshBVH } from './geometry';

function createBoxElement(
  id: string | number,
  size: [number, number, number],
  center: [number, number, number],
  ifcClass = 'IfcWall',
  guid?: string,
): NarrowphaseElement {
  const boxGeom = new THREE.BoxGeometry(size[0], size[1], size[2]);
  boxGeom.translate(center[0], center[1], center[2]);

  const pos = new Float32Array(boxGeom.attributes.position!.array);
  const idx = new Uint32Array(boxGeom.index!.array);

  const geom = createBufferGeometry(pos, idx);
  geom.computeBoundingBox();

  const bvh = createMeshBVH(geom);

  return {
    id,
    guid: guid ?? `guid_${id}`,
    ifcClass,
    geometry: geom,
    bvh,
    box: geom.boundingBox!.clone(),
    triangleCount: idx.length / 3,
  };
}

describe('clash narrowphase detection', () => {
  it('detects Hard clash for two intersecting boxes and computes intersection center', () => {
    // Box A: size 2x2x2 centered at (0, 0, 0) -> [-1, 1]
    const boxA = createBoxElement('A1', [2, 2, 2], [0, 0, 0]);
    // Box B: size 2x2x2 centered at (1, 0, 0) -> [0, 2]
    // Intersection volume is [0, 1] x [-1, 1] x [-1, 1] -> center is (0.5, 0, 0)
    const boxB = createBoxElement('B1', [2, 2, 2], [1, 0, 0]);

    const result = checkNarrowphasePair(boxA, boxB, 'Hard', 0, 'test_01');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('Hard');
    expect(result!.distance).toBe(0);
    expect(result!.point[0]).toBeCloseTo(0.5, 3);
    expect(result!.point[1]).toBeCloseTo(0, 3);
    expect(result!.point[2]).toBeCloseTo(0, 3);
  });

  it('detects Clearance clash when elements are within tolerance without intersecting', () => {
    // Box A: [-1, 1] along X
    const boxA = createBoxElement('A1', [2, 2, 2], [0, 0, 0]);
    // Box B: size 2x2x2 centered at 2.05 -> [1.05, 3.05] along X -> 5cm gap
    const boxB = createBoxElement('B1', [2, 2, 2], [2.05, 0, 0]);

    // Tolerance 0.10m (10cm) > gap 0.05m -> Clearance detected
    const resultLargeTol = checkNarrowphasePair(boxA, boxB, 'Clearance', 0.10, 'test_01');
    expect(resultLargeTol).not.toBeNull();
    expect(resultLargeTol!.type).toBe('Clearance');
    expect(resultLargeTol!.distance).toBeCloseTo(0.05, 3);

    // Tolerance 0.02m (2cm) < gap 0.05m -> 0 clash
    const resultSmallTol = checkNarrowphasePair(boxA, boxB, 'Clearance', 0.02, 'test_01');
    expect(resultSmallTol).toBeNull();
  });

  it('detects Duplicates for identical or co-located elements of the same class', () => {
    const boxA = createBoxElement('A1', [2, 2, 2], [0, 0, 0], 'IfcColumn');
    const boxB = createBoxElement('B1', [2, 2, 2], [0.001, 0, 0], 'IfcColumn'); // 1mm offset

    // With tolerance 0.005m (5mm), boxes are duplicate
    const result = checkNarrowphasePair(boxA, boxB, 'Duplicates', 0.005, 'test_01');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('Duplicates');
    expect(result!.distance).toBe(0);

    // If IFC classes differ, they are not duplicates
    const boxC = createBoxElement('C1', [2, 2, 2], [0, 0, 0], 'IfcBeam');
    const resultDiffClass = checkNarrowphasePair(boxA, boxC, 'Duplicates', 0.005, 'test_01');
    expect(resultDiffClass).toBeNull();
  });

  it('classifies touching faces (distance = 0) consistently as Hard clash', () => {
    // Box A: [-0.5, 0.5] along X
    const boxA = createBoxElement('A1', [1, 1, 1], [0, 0, 0]);
    // Box B: [0.5, 1.5] along X -> face-to-face touching at x = 0.5
    const boxB = createBoxElement('B1', [1, 1, 1], [1.0, 0, 0]);

    // Touching faces have physical geometric contact -> Hard clash
    const resultHard = checkNarrowphasePair(boxA, boxB, 'Hard', 0, 'test_01');
    expect(resultHard).not.toBeNull();
    expect(resultHard!.type).toBe('Hard');
    expect(resultHard!.distance).toBe(0);

    // For Clearance (which requires non-intersecting distance > 0), touching faces return null
    const resultClearance = checkNarrowphasePair(boxA, boxB, 'Clearance', 0.10, 'test_01');
    expect(resultClearance).toBeNull();
  });

  it('produces stable hash clashId regardless of element ordering', () => {
    const id1 = generateClashId('test_x', 'GUID_AAA', 'GUID_BBB');
    const id2 = generateClashId('test_x', 'GUID_BBB', 'GUID_AAA');

    expect(id1).toBe(id2);
    expect(id1.startsWith('clash_')).toBe(true);

    // Different testId produces different hash
    const id3 = generateClashId('test_y', 'GUID_AAA', 'GUID_BBB');
    expect(id3).not.toBe(id1);
  });
});

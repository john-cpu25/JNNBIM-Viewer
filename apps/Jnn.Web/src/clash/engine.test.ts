import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { runClashTest, type ClashTestConfig, type ClashProgress } from './engine';
import { ClashWorkerClient } from './clashWorkerClient';
import type { NarrowphaseElement, ClashResult } from './narrowphase';
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

describe('clash engine orchestrator and worker wrapper', () => {
  it('runs clash test with broad-phase and narrow-phase, reporting progress and batch results', async () => {
    const elementMap = new Map<string | number, NarrowphaseElement>();

    // Create 3 walls in Set A along X: at x=0, x=5, x=10
    elementMap.set('A1', createBoxElement('A1', [2, 2, 2], [0, 0, 0]));
    elementMap.set('A2', createBoxElement('A2', [2, 2, 2], [5, 0, 0]));
    elementMap.set('A3', createBoxElement('A3', [2, 2, 2], [10, 0, 0]));

    // Create 2 beams in Set B:
    // B1 intersects A1 at (0.5, 0, 0)
    // B2 is far at (20, 0, 0)
    elementMap.set('B1', createBoxElement('B1', [2, 2, 2], [0.5, 0, 0]));
    elementMap.set('B2', createBoxElement('B2', [2, 2, 2], [20, 0, 0]));

    const progressReports: ClashProgress[] = [];
    const batchResults: ClashResult[][] = [];

    const config: ClashTestConfig = {
      id: 'test_hard_01',
      name: 'Arch x Struct Hard',
      type: 'Hard',
      tolerance: 0,
      selectionA: ['A1', 'A2', 'A3'],
      selectionB: ['B1', 'B2'],
    };

    const summary = await runClashTest(
      config,
      elementMap,
      {
        onProgress: (p) => progressReports.push(p),
        onBatchResults: (b) => batchResults.push(b),
      },
      1, // batch size 1 for testing
    );

    expect(summary.status).toBe('completed');
    expect(summary.clashesCount).toBe(1);
    expect(summary.results[0]!.aId).toBe('A1');
    expect(summary.results[0]!.bId).toBe('B1');
    expect(summary.results[0]!.type).toBe('Hard');

    // Progress assertions
    expect(progressReports.length).toBeGreaterThan(0);
    expect(progressReports[progressReports.length - 1]!.percent).toBe(100);

    // Batch assertions
    const allBatched = batchResults.flat();
    expect(allBatched).toHaveLength(1);
  });

  it('cancels test midway and returns partial results with cancelled status', async () => {
    const elementMap = new Map<string | number, NarrowphaseElement>();

    // 10 overlapping pairs along X
    const selA: string[] = [];
    const selB: string[] = [];
    for (let i = 0; i < 10; i++) {
      const aId = `boxA_${i}`;
      const bId = `boxB_${i}`;
      selA.push(aId);
      selB.push(bId);
      elementMap.set(aId, createBoxElement(aId, [2, 2, 2], [i * 0.1, 0, 0]));
      elementMap.set(bId, createBoxElement(bId, [2, 2, 2], [i * 0.1 + 0.05, 0, 0]));
    }

    let isCancelled = false;
    let checkCount = 0;

    const config: ClashTestConfig = {
      id: 'test_cancel',
      name: 'Test Cancel',
      type: 'Hard',
      tolerance: 0,
      selectionA: selA,
      selectionB: selB,
    };

    const summary = await runClashTest(
      config,
      elementMap,
      {
        onProgress: (p) => {
          checkCount = p.pairsChecked;
          if (p.pairsChecked >= 2) {
            isCancelled = true;
          }
        },
        isCancelled: () => isCancelled,
      },
      1,
    );

    expect(summary.status).toBe('cancelled');
    expect(summary.pairsProcessed).toBeLessThan(summary.candidatesCount);
    expect(checkCount).toBeGreaterThanOrEqual(2);
  });

  it('skips missing geometry and ignores self-clash (A = B)', async () => {
    const elementMap = new Map<string | number, NarrowphaseElement>();
    elementMap.set('A1', createBoxElement('A1', [2, 2, 2], [0, 0, 0]));

    const config: ClashTestConfig = {
      id: 'test_skip',
      name: 'Skip Missing and Self',
      type: 'Hard',
      tolerance: 0,
      selectionA: ['A1', 'MISSING_ELEM'],
      selectionB: ['A1'], // Same element
      ignoreSameElement: true,
    };

    const summary = await runClashTest(config, elementMap);

    expect(summary.status).toBe('completed');
    expect(summary.candidatesCount).toBe(0); // A1 vs A1 ignored
    expect(summary.skippedMissingGeometryCount).toBe(1); // MISSING_ELEM counted as skipped
    expect(summary.clashesCount).toBe(0);
  });

  it('runs clash detection through ClashWorkerClient bridge', async () => {
    const client = new ClashWorkerClient();

    // Prepare serialized payloads for 2 overlapping boxes
    const box1 = new THREE.BoxGeometry(2, 2, 2);
    box1.translate(0, 0, 0);
    const box2 = new THREE.BoxGeometry(2, 2, 2);
    box2.translate(0.5, 0, 0);

    const payload1 = {
      id: 'elem_1',
      guid: 'GUID_001',
      ifcClass: 'IfcWall',
      positions: box1.attributes.position!.array.buffer.slice(0) as ArrayBuffer,
      indices: box1.index!.array.buffer.slice(0) as ArrayBuffer,
      box: { min: [-1, -1, -1] as [number, number, number], max: [1, 1, 1] as [number, number, number] },
    };

    const payload2 = {
      id: 'elem_2',
      guid: 'GUID_002',
      ifcClass: 'IfcBeam',
      positions: box2.attributes.position!.array.buffer.slice(0) as ArrayBuffer,
      indices: box2.index!.array.buffer.slice(0) as ArrayBuffer,
      box: { min: [-0.5, -1, -1] as [number, number, number], max: [1.5, 1, 1] as [number, number, number] },
    };

    const loadedCount = await client.loadElements([payload1, payload2]);
    expect(loadedCount).toBe(2);

    const config: ClashTestConfig = {
      id: 'worker_test',
      name: 'Worker Test',
      type: 'Hard',
      tolerance: 0,
      selectionA: ['elem_1'],
      selectionB: ['elem_2'],
    };

    const summary = await client.runTest(config);
    expect(summary.status).toBe('completed');
    expect(summary.clashesCount).toBe(1);
    expect(summary.results[0]!.clashId).toBeDefined();

    client.terminate();
  });
});

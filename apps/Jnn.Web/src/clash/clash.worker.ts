import * as THREE from 'three';
import type {
  ClashTestConfig,
  ClashProgress,
  ClashRunSummary,
} from './engine';
import { runClashTest } from './engine';
import type { ClashResult, NarrowphaseElement } from './narrowphase';
import { createBufferGeometry, createMeshBVH } from './geometry';

export interface SerializedElementPayload {
  id: string | number;
  guid?: string;
  ifcClass?: string;
  positions: ArrayBuffer;
  indices: ArrayBuffer;
  box: {
    min: [number, number, number];
    max: [number, number, number];
  };
}

export type ClashWorkerIncomingMessage =
  | { type: 'LOAD_ELEMENTS'; elements: SerializedElementPayload[] }
  | { type: 'CLEAR_ELEMENTS' }
  | { type: 'RUN_TEST'; testConfig: ClashTestConfig; batchSize?: number }
  | { type: 'CANCEL_TEST' };

export type ClashWorkerOutgoingMessage =
  | { type: 'ELEMENTS_LOADED'; count: number }
  | { type: 'PROGRESS'; progress: ClashProgress }
  | { type: 'BATCH_RESULTS'; batch: ClashResult[] }
  | { type: 'COMPLETED'; summary: ClashRunSummary }
  | { type: 'ERROR'; error: string };

const workerElementsMap = new Map<string | number, NarrowphaseElement>();
let cancelCurrentRun = false;

export function loadElementsIntoWorker(payloads: SerializedElementPayload[]): number {
  for (const p of payloads) {
    const pos = new Float32Array(p.positions);
    const idx = new Uint32Array(p.indices);
    const geom = createBufferGeometry(pos, idx);
    const box = new THREE.Box3(
      new THREE.Vector3(p.box.min[0], p.box.min[1], p.box.min[2]),
      new THREE.Vector3(p.box.max[0], p.box.max[1], p.box.max[2]),
    );
    const bvh = createMeshBVH(geom);

    workerElementsMap.set(p.id, {
      id: p.id,
      guid: p.guid,
      ifcClass: p.ifcClass,
      box,
      geometry: geom,
      bvh,
      triangleCount: Math.floor(idx.length / 3),
    });
  }
  return workerElementsMap.size;
}

export async function executeTestInWorker(
  config: ClashTestConfig,
  postMessage: (msg: ClashWorkerOutgoingMessage) => void,
  batchSize = 50,
): Promise<ClashRunSummary> {
  cancelCurrentRun = false;

  const summary = await runClashTest(
    config,
    workerElementsMap,
    {
      onProgress: (progress) => postMessage({ type: 'PROGRESS', progress }),
      onBatchResults: (batch) => postMessage({ type: 'BATCH_RESULTS', batch }),
      isCancelled: () => cancelCurrentRun,
    },
    batchSize,
  );

  postMessage({ type: 'COMPLETED', summary });
  return summary;
}

export function cancelWorkerTest(): void {
  cancelCurrentRun = true;
}

// In standard Web Worker context
if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function') {
  self.onmessage = async (e: MessageEvent<ClashWorkerIncomingMessage>) => {
    const msg = e.data;
    try {
      if (msg.type === 'LOAD_ELEMENTS') {
        const count = loadElementsIntoWorker(msg.elements);
        (self as any).postMessage({ type: 'ELEMENTS_LOADED', count });
      } else if (msg.type === 'CLEAR_ELEMENTS') {
        workerElementsMap.clear();
      } else if (msg.type === 'RUN_TEST') {
        await executeTestInWorker(msg.testConfig, (out) => (self as any).postMessage(out), msg.batchSize);
      } else if (msg.type === 'CANCEL_TEST') {
        cancelWorkerTest();
      }
    } catch (err: any) {
      (self as any).postMessage({ type: 'ERROR', error: err.message });
    }
  };
}


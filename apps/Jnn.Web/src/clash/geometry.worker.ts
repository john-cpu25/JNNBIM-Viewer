import * as THREE from 'three';
import { createBufferGeometry, createMeshBVH } from './geometry';

export interface BuildBVHMessage {
  type: 'BUILD_BVH';
  id: string | number;
  positions: ArrayBuffer;
  indices: ArrayBuffer;
}

export interface BuildBVHSuccessResponse {
  type: 'BUILD_BVH_SUCCESS';
  id: string | number;
  triangleCount: number;
  nodeCount: number;
  buildTimeMs: number;
  box: {
    min: [number, number, number];
    max: [number, number, number];
  };
}

export interface BuildBVHErrorResponse {
  type: 'BUILD_BVH_ERROR';
  id: string | number;
  error: string;
}

export type GeometryWorkerResponse = BuildBVHSuccessResponse | BuildBVHErrorResponse;

/**
 * Pure worker execution logic for building MeshBVH from transferable ArrayBuffers.
 */
export function processBuildBVH(data: BuildBVHMessage): BuildBVHSuccessResponse {
  const t0 = performance.now();
  const positions = new Float32Array(data.positions);
  const indices = new Uint32Array(data.indices);

  const geom = createBufferGeometry(positions, indices);
  const bvh = createMeshBVH(geom);

  const buildTimeMs = performance.now() - t0;
  const roots: ArrayBuffer[] = (bvh as any)._roots ?? [];
  const nodeCount = roots.reduce((acc: number, r: ArrayBuffer) => acc + Math.floor(r.byteLength / 32), 0) || roots.length;

  geom.computeBoundingBox();
  const bb = geom.boundingBox ?? new THREE.Box3();

  return {
    type: 'BUILD_BVH_SUCCESS',
    id: data.id,
    triangleCount: Math.floor(indices.length / 3),
    nodeCount,
    buildTimeMs,
    box: {
      min: [bb.min.x, bb.min.y, bb.min.z],
      max: [bb.max.x, bb.max.y, bb.max.z],
    },
  };
}

// In standard Web Worker environment
if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function') {
  self.onmessage = (e: MessageEvent<BuildBVHMessage>) => {
    try {
      if (e.data?.type === 'BUILD_BVH') {
        const res = processBuildBVH(e.data);
        (self as any).postMessage(res);
      }
    } catch (err: any) {
      (self as any).postMessage({
        type: 'BUILD_BVH_ERROR',
        id: e.data?.id,
        error: err.message,
      });
    }
  };
}

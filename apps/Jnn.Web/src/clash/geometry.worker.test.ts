import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { createGeometryWorker, GeometryWorkerClient } from './geometryWorkerClient';
import type { BuildBVHSuccessResponse } from './geometry.worker';

describe('geometry worker BVH generation', () => {
  let client: GeometryWorkerClient | null = null;

  afterEach(() => {
    client?.terminate();
    client = null;
  });

  it('receives geometry ArrayBuffers via postMessage and returns BVH stats', async () => {
    const worker = createGeometryWorker();

    // Box of size 2x2x2 -> 12 triangles
    const box = new THREE.BoxGeometry(2, 2, 2);
    const positions = new Float32Array(box.attributes.position!.array);
    const indices = new Uint32Array(box.index!.array);

    const posBuffer = positions.buffer.slice(0);
    const idxBuffer = indices.buffer.slice(0);

    const responsePromise = new Promise<BuildBVHSuccessResponse>((resolve, reject) => {
      worker.onmessage = (event) => {
        if (event.data.type === 'BUILD_BVH_SUCCESS') {
          resolve(event.data);
        } else {
          reject(new Error(event.data.error));
        }
      };
      worker.onerror = (err) => reject(err);
    });

    // Send via postMessage with Transferable array
    worker.postMessage(
      {
        type: 'BUILD_BVH',
        id: 42,
        positions: posBuffer,
        indices: idxBuffer,
      },
      [posBuffer, idxBuffer],
    );

    const stats = await responsePromise;
    expect(stats.id).toBe(42);
    expect(stats.triangleCount).toBe(12);
    expect(stats.nodeCount).toBeGreaterThan(0);
    expect(stats.buildTimeMs).toBeGreaterThanOrEqual(0);
    expect(stats.box.min).toEqual([-1, -1, -1]);
    expect(stats.box.max).toEqual([1, 1, 1]);

    worker.terminate();
  });

  it('builds MeshBVH for complex geometry using GeometryWorkerClient', async () => {
    client = new GeometryWorkerClient();

    // Sphere geometry -> 480 triangles
    const sphere = new THREE.SphereGeometry(5, 16, 16);
    const positions = new Float32Array(sphere.attributes.position!.array);
    const indices = new Uint32Array(sphere.index!.array);

    const stats = await client.buildBVH('sphere-1', positions, indices);

    expect(stats.id).toBe('sphere-1');
    expect(stats.triangleCount).toBe(480);
    expect(stats.nodeCount).toBeGreaterThanOrEqual(100);
    expect(stats.box.min[0]).toBeCloseTo(-5, 1);
    expect(stats.box.max[0]).toBeCloseTo(5, 1);
  });
});


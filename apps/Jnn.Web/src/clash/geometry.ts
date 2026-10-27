import * as THREE from 'three';
import { MeshBVH, type MeshBVHOptions } from 'three-mesh-bvh';
import type { MeshData } from '@thatopen/fragments';

export interface ElementGeometryData {
  localId: number;
  positions: Float32Array; // Flattened world-space positions [x, y, z, ...]
  indices: Uint32Array;    // Merged triangle indices
  box: THREE.Box3;         // World-space bounding box
  triangleCount: number;
}

export interface BoundingBoxDiff {
  maxError: number;
  minDiff: THREE.Vector3;
  maxDiff: THREE.Vector3;
}

export interface IModelGeometrySource {
  getItemsGeometry(localIds: number[]): Promise<MeshData[][]>;
  object?: THREE.Object3D | null;
}

/**
 * Extracts triangle mesh data in world space for a list of local element IDs.
 * Combines multiple meshes belonging to the same element into a single contiguous
 * vertex & index buffer and computes the world-space bounding box.
 */
export async function extractElementGeometry(
  model: IModelGeometrySource,
  localIds: number[],
): Promise<ElementGeometryData[]> {
  if (!localIds || localIds.length === 0) {
    return [];
  }

  // Ensure model's world matrix is up to date if object exists
  if (model.object) {
    model.object.updateMatrixWorld?.(true);
  }
  const modelWorldMatrix = model.object?.matrixWorld ?? new THREE.Matrix4();

  const meshesPerItem = await model.getItemsGeometry(localIds);
  const results: ElementGeometryData[] = [];

  for (let i = 0; i < localIds.length; i++) {
    const localId = localIds[i];
    if (localId === undefined) continue;

    const meshes = meshesPerItem[i];
    if (!meshes || meshes.length === 0) {
      continue;
    }

    // First pass: compute total vertex and index counts across all meshes for this element
    let totalVertices = 0;
    let totalIndices = 0;

    for (const mesh of meshes) {
      if (!mesh.positions || mesh.positions.length === 0) continue;
      const vCount = Math.floor(mesh.positions.length / 3);
      totalVertices += vCount;
      if (mesh.indices && mesh.indices.length > 0) {
        totalIndices += mesh.indices.length;
      } else {
        totalIndices += vCount; // Non-indexed triangles
      }
    }

    if (totalVertices === 0 || totalIndices === 0) {
      continue;
    }

    const mergedPositions = new Float32Array(totalVertices * 3);
    const mergedIndices = new Uint32Array(totalIndices);

    const box = new THREE.Box3();
    box.makeEmpty();

    let vertexOffset = 0;
    let indexOffset = 0;

    for (const mesh of meshes) {
      if (!mesh.positions || mesh.positions.length === 0) continue;

      const rawPos = mesh.positions;
      const rawIndices = mesh.indices;
      const meshVCount = Math.floor(rawPos.length / 3);

      // Compute composite world transform: modelWorldMatrix * mesh.transform
      let meshTransform = new THREE.Matrix4();
      if (!mesh.transform) {
        // identity
      } else if (mesh.transform instanceof THREE.Matrix4) {
        meshTransform.copy(mesh.transform);
      } else if ('elements' in (mesh.transform as any) && (mesh.transform as any).elements) {
        meshTransform.fromArray((mesh.transform as any).elements);
      } else if (Array.isArray(mesh.transform) || ArrayBuffer.isView(mesh.transform)) {
        meshTransform.fromArray(mesh.transform as any);
      }

      const worldMatrix = new THREE.Matrix4().multiplyMatrices(modelWorldMatrix, meshTransform);
      const e = worldMatrix.elements;

      // Transform positions to world space and update bounding box
      const basePosIdx = vertexOffset * 3;
      for (let j = 0; j < meshVCount; j++) {
        const sj = j * 3;
        const dj = basePosIdx + sj;

        const x = rawPos[sj] ?? 0;
        const y = rawPos[sj + 1] ?? 0;
        const z = rawPos[sj + 2] ?? 0;

        const w = 1 / ((e[3] ?? 0) * x + (e[7] ?? 0) * y + (e[11] ?? 0) * z + (e[15] ?? 1));
        const wx = ((e[0] ?? 1) * x + (e[4] ?? 0) * y + (e[8] ?? 0) * z + (e[12] ?? 0)) * w;
        const wy = ((e[1] ?? 0) * x + (e[5] ?? 1) * y + (e[9] ?? 0) * z + (e[13] ?? 0)) * w;
        const wz = ((e[2] ?? 0) * x + (e[6] ?? 0) * y + (e[10] ?? 1) * z + (e[14] ?? 0)) * w;

        mergedPositions[dj] = wx;
        mergedPositions[dj + 1] = wy;
        mergedPositions[dj + 2] = wz;

        // Expand Box3
        if (wx < box.min.x) box.min.x = wx;
        if (wy < box.min.y) box.min.y = wy;
        if (wz < box.min.z) box.min.z = wz;
        if (wx > box.max.x) box.max.x = wx;
        if (wy > box.max.y) box.max.y = wy;
        if (wz > box.max.z) box.max.z = wz;
      }

      // Populate indices with vertexOffset
      if (rawIndices && rawIndices.length > 0) {
        for (let k = 0; k < rawIndices.length; k++) {
          mergedIndices[indexOffset + k] = (rawIndices[k] ?? 0) + vertexOffset;
        }
        indexOffset += rawIndices.length;
      } else {
        for (let k = 0; k < meshVCount; k++) {
          mergedIndices[indexOffset + k] = k + vertexOffset;
        }
        indexOffset += meshVCount;
      }

      vertexOffset += meshVCount;
    }

    results.push({
      localId,
      positions: mergedPositions,
      indices: mergedIndices,
      box,
      triangleCount: Math.floor(totalIndices / 3),
    });
  }

  return results;
}

/**
 * Creates a THREE.BufferGeometry from positions and indices arrays.
 */
export function createBufferGeometry(positions: Float32Array, indices: Uint32Array): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds a MeshBVH spatial acceleration structure from a BufferGeometry.
 */
export function createMeshBVH(geometry: THREE.BufferGeometry, options?: MeshBVHOptions): MeshBVH {
  return new MeshBVH(geometry, {
    ...options,
  });
}

/**
 * Compares two THREE.Box3 bounding boxes and calculates maximum coordinate deviation.
 */
export function compareBoundingBoxes(boxA: THREE.Box3, boxB: THREE.Box3): BoundingBoxDiff {
  const minDiff = new THREE.Vector3(
    Math.abs(boxA.min.x - boxB.min.x),
    Math.abs(boxA.min.y - boxB.min.y),
    Math.abs(boxA.min.z - boxB.min.z),
  );
  const maxDiff = new THREE.Vector3(
    Math.abs(boxA.max.x - boxB.max.x),
    Math.abs(boxA.max.y - boxB.max.y),
    Math.abs(boxA.max.z - boxB.max.z),
  );
  const maxError = Math.max(
    minDiff.x, minDiff.y, minDiff.z,
    maxDiff.x, maxDiff.y, maxDiff.z,
  );
  return { maxError, minDiff, maxDiff };
}

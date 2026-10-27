import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  extractElementGeometry,
  createBufferGeometry,
  createMeshBVH,
  compareBoundingBoxes,
  type IModelGeometrySource,
} from './geometry';
import type { MeshData } from '@thatopen/fragments';

describe('geometry extraction and MeshBVH', () => {
  it('extracts geometry from a single mesh with local transform', async () => {
    // A single cube centered at (0,0,0) with size 2: min (-1,-1,-1), max (1,1,1)
    // Transformed by translation (10, 20, 30)
    const cubeGeom = new THREE.BoxGeometry(2, 2, 2);
    const positions = new Float32Array(cubeGeom.attributes.position!.array);
    const indices = new Uint32Array(cubeGeom.index!.array);

    const transform = new THREE.Matrix4().makeTranslation(10, 20, 30);

    const mockModel: IModelGeometrySource = {
      getItemsGeometry: async (): Promise<MeshData[][]> => {
        return [
          [
            {
              transform,
              positions,
              indices,
            } as MeshData,
          ],
        ];
      },
    };

    const elements = await extractElementGeometry(mockModel, [101]);
    expect(elements).toHaveLength(1);

    const el = elements[0]!;
    expect(el.localId).toBe(101);
    expect(el.triangleCount).toBe(12); // Box has 12 triangles
    expect(el.positions.length).toBe(positions.length);
    expect(el.indices.length).toBe(indices.length);

    // Bounding box should be centered at (10, 20, 30) with half-extent 1 -> min (9, 19, 29), max (11, 21, 31)
    expect(el.box.min.x).toBeCloseTo(9, 5);
    expect(el.box.min.y).toBeCloseTo(19, 5);
    expect(el.box.min.z).toBeCloseTo(29, 5);
    expect(el.box.max.x).toBeCloseTo(11, 5);
    expect(el.box.max.y).toBeCloseTo(21, 5);
    expect(el.box.max.z).toBeCloseTo(31, 5);
  });

  it('merges multiple meshes belonging to the same element', async () => {
    // Element with two meshes: Box at (0,0,0) and Box at (5,0,0)
    const box1 = new THREE.BoxGeometry(1, 1, 1);
    const box2 = new THREE.BoxGeometry(1, 1, 1);

    const mockModel: IModelGeometrySource = {
      getItemsGeometry: async () => [
        [
          {
            transform: new THREE.Matrix4(),
            positions: new Float32Array(box1.attributes.position!.array),
            indices: new Uint32Array(box1.index!.array),
          } as MeshData,
          {
            transform: new THREE.Matrix4().makeTranslation(5, 0, 0),
            positions: new Float32Array(box2.attributes.position!.array),
            indices: new Uint32Array(box2.index!.array),
          } as MeshData,
        ],
      ],
    };

    const elements = await extractElementGeometry(mockModel, [202]);
    expect(elements).toHaveLength(1);

    const el = elements[0]!;
    expect(el.triangleCount).toBe(24); // 12 + 12
    expect(el.box.min.x).toBeCloseTo(-0.5, 5);
    expect(el.box.max.x).toBeCloseTo(5.5, 5);

    // Verify index offsets: second mesh indices must be offset by box1 vertex count
    const v1Count = box1.attributes.position!.count;
    const firstMeshIdxMax = Math.max(...el.indices.slice(0, 36));
    const secondMeshIdxMin = Math.min(...el.indices.slice(36));
    expect(firstMeshIdxMax).toBeLessThan(v1Count);
    expect(secondMeshIdxMin).toBeGreaterThanOrEqual(v1Count);
  });

  it('incorporates model.object.matrixWorld into world space transformation', async () => {
    const box = new THREE.BoxGeometry(2, 2, 2);
    const modelObject = new THREE.Object3D();
    modelObject.position.set(100, 0, 0);
    modelObject.updateMatrixWorld(true);

    const mockModel: IModelGeometrySource = {
      object: modelObject,
      getItemsGeometry: async () => [
        [
          {
            transform: new THREE.Matrix4().makeTranslation(0, 50, 0),
            positions: new Float32Array(box.attributes.position!.array),
            indices: new Uint32Array(box.index!.array),
          } as MeshData,
        ],
      ],
    };

    const elements = await extractElementGeometry(mockModel, [303]);
    const el = elements[0]!;
    // Center was (0,0,0) -> mesh translate (0,50,0) -> model translate (100,0,0) -> world (100, 50, 0)
    expect(el.box.min.x).toBeCloseTo(99, 5);
    expect(el.box.min.x).toBeCloseTo(99, 5);
    expect(el.box.max.x).toBeCloseTo(101, 5);
    expect(el.box.min.y).toBeCloseTo(49, 5);
    expect(el.box.max.y).toBeCloseTo(51, 5);
  });

  it('creates BufferGeometry and builds valid MeshBVH', () => {
    const box = new THREE.BoxGeometry(1, 2, 3);
    const positions = new Float32Array(box.attributes.position!.array);
    const indices = new Uint32Array(box.index!.array);

    const geom = createBufferGeometry(positions, indices);
    expect(geom.getAttribute('position')).toBeDefined();
    expect(geom.getIndex()).toBeDefined();

    const bvh = createMeshBVH(geom);
    expect(bvh).toBeDefined();
    expect(bvh.geometry).toBe(geom);
  });

  it('compares bounding boxes correctly', () => {
    const boxA = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 10, 10));
    const boxB = new THREE.Box3(new THREE.Vector3(0.001, 0, 0), new THREE.Vector3(10, 10.002, 10));

    const diff = compareBoundingBoxes(boxA, boxB);
    expect(diff.maxError).toBeCloseTo(0.002, 5);

    const identicalDiff = compareBoundingBoxes(boxA, boxA);
    expect(identicalDiff.maxError).toBe(0);
  });
});

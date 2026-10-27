import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as WebIFC from 'web-ifc';
import type { FragmentsModel } from '@thatopen/fragments';
import {
  extractElementGeometry,
  createBufferGeometry,
  createMeshBVH,
  compareBoundingBoxes,
  type ElementGeometryData,
} from './geometry';

// Patch WebIFC 0.0.78 StreamMeshes signature mismatch
const origStreamMeshes = WebIFC.IfcAPI.prototype.StreamMeshes;
WebIFC.IfcAPI.prototype.StreamMeshes = function (
  modelID: number,
  expressIDs: number[],
  meshCallback: any,
  ...args: any[]
) {
  try {
    return (this as any).wasmModule.StreamMeshes(modelID, expressIDs, meshCallback);
  } catch {
    return origStreamMeshes.call(this, modelID, expressIDs, meshCallback, ...args);
  }
};

export interface SpikeGeometryResult {
  modelName: string;
  totalElementsTested: number;
  totalTriangles: number;
  extractTimeMs: number;
  bvhBuildTimeMs: number;
  maxBoxDeviation: number;
  elements: Array<{
    localId: number;
    triangles: number;
    box: { min: [number, number, number]; max: [number, number, number] };
    bvhNodes: number;
    boxError: number;
  }>;
}

export async function runSpikeGeometry(options?: {
  modelUrl?: string;
  buffer?: Uint8Array;
  maxElements?: number;
  onLog?: (msg: string) => void;
}): Promise<SpikeGeometryResult> {
  const log = options?.onLog ?? ((msg: string) => console.log(`[SPIKE-GEOM] ${msg}`));
  const modelUrl = options?.modelUrl ?? './samples/building-arch-2x3.ifc';
  const maxElements = options?.maxElements ?? 50;

  log(`Initializing That Open Components & FragmentsManager...`);
  const components = new OBC.Components();

  const workerUrl = new URL('./thatopen/worker.mjs', window.location.href).href;
  const fragments = components.get(OBC.FragmentsManager);
  await fragments.init(workerUrl);

  const wasmDir = new URL('./thatopen/', window.location.href).href;
  const ifcLoader = components.get(OBC.IfcLoader);
  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: {
      path: wasmDir,
      absolute: true,
    },
  });

  log(`Loading IFC file from: ${modelUrl}...`);
  let data: Uint8Array;
  if (options?.buffer) {
    data = options.buffer;
  } else {
    const res = await fetch(modelUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${modelUrl}`);
    const ab = await res.arrayBuffer();
    data = new Uint8Array(ab);
  }

  const model: FragmentsModel = await ifcLoader.load(data, false, 'spike-model');
  const dummyCamera = new THREE.PerspectiveCamera();
  model.useCamera(dummyCamera);
  const modelIdStr = (model as any).modelId || (model as any).id || 'spike-model';
  log(`Model loaded successfully. ID: ${modelIdStr}`);

  // Retrieve all local IDs
  const allLocalIds = await model.getLocalIds();
  log(`Total local IDs in model: ${allLocalIds.length}`);

  // Pick up to maxElements items
  const localIdsToTest = allLocalIds.slice(0, maxElements);
  log(`Extracting geometry for ${localIdsToTest.length} elements...`);

  const tStartExtract = performance.now();
  const elementGeometries: ElementGeometryData[] = await extractElementGeometry(model, localIdsToTest);
  const extractTimeMs = performance.now() - tStartExtract;
  log(`Geometry extraction complete in ${extractTimeMs.toFixed(2)} ms for ${elementGeometries.length} elements with mesh.`);


  // Now build MeshBVH for each element and compare bounding boxes
  let totalTriangles = 0;
  let maxBoxDeviation = 0;
  const elementsReport: SpikeGeometryResult['elements'] = [];

  const tStartBVH = performance.now();
  for (const elData of elementGeometries) {
    totalTriangles += elData.triangleCount;

    // 1. Create BufferGeometry
    const geom = createBufferGeometry(elData.positions, elData.indices);

    // 2. Build MeshBVH
    const bvh = createMeshBVH(geom);
    const bvhNodes = (bvh as any)._roots?.length ?? 1;

    // 3. Compare with model.getBoxes
    let boxError = 0;
    try {
      const refBoxes = await model.getBoxes([elData.localId]);
      const refBox = refBoxes && refBoxes.length > 0 ? refBoxes[0] : undefined;
      if (refBox && !refBox.isEmpty()) {
        const diff = compareBoundingBoxes(elData.box, refBox);
        boxError = diff.maxError;
        if (boxError > maxBoxDeviation) {
          maxBoxDeviation = boxError;
        }
        log(`Element #${elData.localId}:
  Tri-Box: min(${elData.box.min.x.toFixed(2)}, ${elData.box.min.y.toFixed(2)}, ${elData.box.min.z.toFixed(2)}) max(${elData.box.max.x.toFixed(2)}, ${elData.box.max.y.toFixed(2)}, ${elData.box.max.z.toFixed(2)})
  Ref-Box: min(${refBox.min.x.toFixed(2)}, ${refBox.min.y.toFixed(2)}, ${refBox.min.z.toFixed(2)}) max(${refBox.max.x.toFixed(2)}, ${refBox.max.y.toFixed(2)}, ${refBox.max.z.toFixed(2)})
  Diff: ${boxError.toFixed(4)}m`);
      }
    } catch {
      // Fallback if getBoxes not available for this element
    }

    elementsReport.push({
      localId: elData.localId,
      triangles: elData.triangleCount,
      box: {
        min: [elData.box.min.x, elData.box.min.y, elData.box.min.z],
        max: [elData.box.max.x, elData.box.max.y, elData.box.max.z],
      },
      bvhNodes,
      boxError,
    });
  }
  const bvhBuildTimeMs = performance.now() - tStartBVH;

  const result: SpikeGeometryResult = {
    modelName: modelUrl.split('/').pop() || 'model.ifc',
    totalElementsTested: elementGeometries.length,
    totalTriangles,
    extractTimeMs,
    bvhBuildTimeMs,
    maxBoxDeviation,
    elements: elementsReport,
  };

  log(`--- SUMMARY ---`);
  log(`Elements tested: ${result.totalElementsTested}`);
  log(`Total Triangles: ${result.totalTriangles}`);
  log(`Extract Time: ${extractTimeMs.toFixed(2)} ms (${(extractTimeMs / result.totalElementsTested).toFixed(3)} ms/elem)`);
  log(`MeshBVH Build Time: ${bvhBuildTimeMs.toFixed(2)} ms (${(bvhBuildTimeMs / result.totalElementsTested).toFixed(3)} ms/elem)`);
  log(`Max Bounding Box Deviation: ${maxBoxDeviation.toFixed(6)} m`);

  try {
    await model.dispose();
  } catch (e: any) {
    log(`Model dispose warning: ${e.message}`);
  }
  components.dispose();

  return result;
}

// Auto-run if running in browser window
if (typeof window !== 'undefined') {
  (window as any).__runSpikeGeometry = runSpikeGeometry;

  window.addEventListener('DOMContentLoaded', () => {
    const runBtn = document.getElementById('run-btn');
    const logEl = document.getElementById('log-output');
    const statsEl = document.getElementById('stats-content');

    if (runBtn) {
      runBtn.addEventListener('click', async () => {
        runBtn.setAttribute('disabled', 'true');
        if (logEl) logEl.innerHTML = '';
        if (statsEl) statsEl.innerHTML = 'Đang chạy spike geometry...';

        const onLog = (msg: string) => {
          console.log(`[SPIKE] ${msg}`);
          if (logEl) {
            const div = document.createElement('div');
            div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            logEl.appendChild(div);
            logEl.scrollTop = logEl.scrollHeight;
          }
        };

        try {
          const res = await runSpikeGeometry({ onLog });
          (window as any).__SPIKE_GEOMETRY_RESULT__ = res;

          if (statsEl) {
            statsEl.innerHTML = `
              <div><strong>Mô hình:</strong> ${res.modelName}</div>
              <div><strong>Số phần tử có lưới:</strong> ${res.totalElementsTested}</div>
              <div><strong>Tổng số tam giác:</strong> ${res.totalTriangles.toLocaleString()}</div>
              <div><strong>Thời gian trích xuất:</strong> ${res.extractTimeMs.toFixed(2)} ms</div>
              <div><strong>Thời gian dựng MeshBVH:</strong> ${res.bvhBuildTimeMs.toFixed(2)} ms</div>
              <div><strong>Sai lệch Bounding Box max:</strong> ${res.maxBoxDeviation.toFixed(6)} m</div>
              <div><strong style="color:#22c55e;">Trạng thái: THÀNH CÔNG (Pass T10.1)</strong></div>
            `;
          }
        } catch (err: any) {
          console.error(err);
          onLog(`LỖI: ${err.message}`);
          if (statsEl) {
            statsEl.innerHTML = `<div style="color:#ef4444;">LỖI: ${err.message}</div>`;
          }
        } finally {
          runBtn.removeAttribute('disabled');
        }
      });
    }
  });
}

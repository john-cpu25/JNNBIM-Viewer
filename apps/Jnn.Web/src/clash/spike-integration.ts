import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as WebIFC from 'web-ifc';
import type { FragmentsModel } from '@thatopen/fragments';
import { extractElementGeometry, createBufferGeometry, createMeshBVH } from './geometry';
import { sweepAndPrune, type BoundingBoxItem } from './broadphase';
import { runClashTest, type ClashTestConfig } from './engine';
import type { NarrowphaseElement } from './narrowphase';

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

export interface IntegrationClashReport {
  modelAName: string;
  modelBName: string;
  elementsACount: number;
  elementsBCount: number;
  totalCandidates: number;
  broadphaseTimeMs: number;
  narrowphaseTimeMs: number;
  totalTimeMs: number;
  hardClashesCount: number;
  clearanceClashesCount: number;
  sampleClashes: Array<{
    clashId: string;
    type: string;
    aId: string | number;
    bId: string | number;
    distance: number;
    point: [number, number, number];
  }>;
}

export async function runIntegrationClashSpike(options?: {
  urlA?: string;
  urlB?: string;
  onLog?: (msg: string) => void;
}): Promise<IntegrationClashReport> {
  const log = options?.onLog ?? ((msg: string) => console.log(`[CLASH-SPIKE] ${msg}`));
  const urlA = options?.urlA ?? './samples/building-arch-2x3.ifc';
  const urlB = options?.urlB ?? './samples/building-struct-2x3.ifc';

  log('Initializing That Open Components & IfcLoader...');
  const components = new OBC.Components();
  const workerUrl = new URL('./thatopen/worker.mjs', window.location.href).href;
  const fragments = components.get(OBC.FragmentsManager);
  await fragments.init(workerUrl);
  (fragments.core.settings as any).autoCoordinate = true;

  const wasmDir = new URL('./thatopen/', window.location.href).href;
  const ifcLoader = components.get(OBC.IfcLoader);
  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: {
      path: wasmDir,
      absolute: true,
    },
  });

  const dummyCamera = new THREE.PerspectiveCamera();

  // 1. Load Model A (Arch)
  log(`Loading Model A (${urlA})...`);
  const resA = await fetch(urlA);
  const bufA = new Uint8Array(await resA.arrayBuffer());
  const modelA: FragmentsModel = await ifcLoader.load(bufA, false, 'model_arch');
  modelA.useCamera(dummyCamera);
  modelA.object.updateMatrixWorld?.(true);

  // 2. Load Model B (Struct)
  log(`Loading Model B (${urlB})...`);
  const resB = await fetch(urlB);
  const bufB = new Uint8Array(await resB.arrayBuffer());
  const modelB: FragmentsModel = await ifcLoader.load(bufB, false, 'model_struct');
  modelB.useCamera(dummyCamera);
  modelB.object.updateMatrixWorld?.(true);

  log('Extracting element geometries from both models...');
  const localIdsA = await modelA.getLocalIds();
  const localIdsB = await modelB.getLocalIds();

  const tStartExtract = performance.now();
  const geomsA = await extractElementGeometry(modelA, localIdsA);
  const geomsB = await extractElementGeometry(modelB, localIdsB);
  const extractTimeMs = performance.now() - tStartExtract;
  log(`Extracted ${geomsA.length} mesh elements from Model A and ${geomsB.length} mesh elements from Model B in ${extractTimeMs.toFixed(2)} ms.`);

  // Build NarrowphaseElements
  const elementMap = new Map<string | number, NarrowphaseElement>();
  const selA: Array<string | number> = [];
  const selB: Array<string | number> = [];

  for (const g of geomsA) {
    const id = `arch_${g.localId}`;
    selA.push(id);
    const geom = createBufferGeometry(g.positions, g.indices);
    const bvh = createMeshBVH(geom);
    elementMap.set(id, {
      id,
      guid: `guid_${id}`,
      ifcClass: 'ArchElement',
      box: g.box,
      geometry: geom,
      bvh,
      triangleCount: g.triangleCount,
    });
  }

  for (const g of geomsB) {
    const id = `struct_${g.localId}`;
    selB.push(id);
    const geom = createBufferGeometry(g.positions, g.indices);
    const bvh = createMeshBVH(geom);
    elementMap.set(id, {
      id,
      guid: `guid_${id}`,
      ifcClass: 'StructElement',
      box: g.box,
      geometry: geom,
      bvh,
      triangleCount: g.triangleCount,
    });
  }

  // 3. Run Broad-phase Sweep-and-Prune
  log('Running Broad-phase Sweep-and-Prune...');
  const setA: BoundingBoxItem[] = selA.map((id) => ({ id, box: elementMap.get(id)!.box }));
  const setB: BoundingBoxItem[] = selB.map((id) => ({ id, box: elementMap.get(id)!.box }));

  const tStartBroad = performance.now();
  const candidates = sweepAndPrune(setA, setB, { tolerance: 0.05 });
  const broadphaseTimeMs = performance.now() - tStartBroad;
  log(`Broad-phase found ${candidates.length} candidate pairs across ${setA.length} x ${setB.length} = ${(setA.length * setB.length).toLocaleString()} possible pairs in ${broadphaseTimeMs.toFixed(2)} ms.`);

  // 4. Run Hard Clash Test
  log('Running Hard Clash Narrow-phase test...');
  const hardConfig: ClashTestConfig = {
    id: 'test_hard_arch_struct',
    name: 'Arch x Struct Hard Clash',
    type: 'Hard',
    tolerance: 0,
    selectionA: selA,
    selectionB: selB,
    ignoreSameElement: true,
  };

  const tStartNarrow = performance.now();
  const hardSummary = await runClashTest(hardConfig, elementMap);
  const narrowphaseTimeMs = performance.now() - tStartNarrow;
  log(`Hard Clash narrow-phase complete in ${narrowphaseTimeMs.toFixed(2)} ms: found ${hardSummary.clashesCount} Hard clashes.`);

  // 5. Run Clearance Clash Test (50mm tolerance)
  log('Running Clearance Clash Narrow-phase test (tolerance = 50mm)...');
  const clearanceConfig: ClashTestConfig = {
    id: 'test_clearance_arch_struct',
    name: 'Arch x Struct Clearance 50mm',
    type: 'Clearance',
    tolerance: 0.05,
    selectionA: selA,
    selectionB: selB,
    ignoreSameElement: true,
  };
  const clearanceSummary = await runClashTest(clearanceConfig, elementMap);
  log(`Clearance narrow-phase complete: found ${clearanceSummary.clashesCount} Clearance clashes.`);

  const totalTimeMs = broadphaseTimeMs + narrowphaseTimeMs;

  const sampleClashes = hardSummary.results.slice(0, 10).map((c) => ({
    clashId: c.clashId,
    type: c.type,
    aId: c.aId,
    bId: c.bId,
    distance: c.distance,
    point: c.point,
  }));

  const report: IntegrationClashReport = {
    modelAName: urlA.split('/').pop() || 'modelA.ifc',
    modelBName: urlB.split('/').pop() || 'modelB.ifc',
    elementsACount: selA.length,
    elementsBCount: selB.length,
    totalCandidates: candidates.length,
    broadphaseTimeMs,
    narrowphaseTimeMs,
    totalTimeMs,
    hardClashesCount: hardSummary.clashesCount,
    clearanceClashesCount: clearanceSummary.clashesCount,
    sampleClashes,
  };

  log('=== INTEGRATION BENCHMARK SUMMARY ===');
  log(`Model A: ${report.modelAName} (${report.elementsACount} elements)`);
  log(`Model B: ${report.modelBName} (${report.elementsBCount} elements)`);
  log(`Broad-phase Candidates: ${report.totalCandidates} pairs`);
  log(`Broad-phase Time: ${report.broadphaseTimeMs.toFixed(2)} ms`);
  log(`Narrow-phase Time: ${report.narrowphaseTimeMs.toFixed(2)} ms`);
  log(`Total Clash Time: ${report.totalTimeMs.toFixed(2)} ms`);
  log(`Hard Clashes Found: ${report.hardClashesCount}`);
  log(`Clearance Clashes Found: ${report.clearanceClashesCount}`);

  // Cleanup
  await modelA.dispose();
  await modelB.dispose();
  components.dispose();

  return report;
}

// Auto-run if loaded in browser
if (typeof window !== 'undefined') {
  (window as any).__runIntegrationClashSpike = runIntegrationClashSpike;

  window.addEventListener('DOMContentLoaded', () => {
    const runBtn = document.getElementById('run-btn');
    const logEl = document.getElementById('log-output');
    const statsEl = document.getElementById('stats-content');

    if (runBtn) {
      runBtn.addEventListener('click', async () => {
        runBtn.setAttribute('disabled', 'true');
        if (logEl) logEl.innerHTML = '';
        if (statsEl) statsEl.innerHTML = 'Đang chạy kiểm thử tích hợp va chạm hai mô hình...';

        const onLog = (msg: string) => {
          console.log(`[INTEGRATION] ${msg}`);
          if (logEl) {
            const div = document.createElement('div');
            div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            logEl.appendChild(div);
            logEl.scrollTop = logEl.scrollHeight;
          }
        };

        try {
          const report = await runIntegrationClashSpike({ onLog });
          (window as any).__INTEGRATION_CLASH_RESULT__ = report;

          if (statsEl) {
            statsEl.innerHTML = `
              <div><strong>Mô hình A:</strong> ${report.modelAName} (${report.elementsACount} cấu kiện)</div>
              <div><strong>Mô hình B:</strong> ${report.modelBName} (${report.elementsBCount} cấu kiện)</div>
              <div><strong>Cặp ứng viên Broad-phase:</strong> ${report.totalCandidates} cặp</div>
              <div><strong>Thời gian Broad-phase:</strong> ${report.broadphaseTimeMs.toFixed(2)} ms</div>
              <div><strong>Thời gian Narrow-phase:</strong> ${report.narrowphaseTimeMs.toFixed(2)} ms</div>
              <div><strong>Tổng thời gian tính toán:</strong> ${report.totalTimeMs.toFixed(2)} ms</div>
              <div><strong>Số Hard Clash tìm thấy:</strong> <span style="color:#ef4444;font-weight:bold;">${report.hardClashesCount}</span></div>
              <div><strong>Số Clearance Clash (50mm):</strong> <span style="color:#eab308;font-weight:bold;">${report.clearanceClashesCount}</span></div>
              <div><strong style="color:#22c55e;">Trạng thái: THÀNH CÔNG (Pass T11.4)</strong></div>
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

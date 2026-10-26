import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as WebIFC from 'web-ifc';
import type { FragmentsModel } from '@thatopen/fragments';

// Patch WebIFC 0.0.78 StreamMeshes signature mismatch between JS wrapper (4 args) and WASM binary (3 args)
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

interface LoadMetrics {
  filename: string;
  filesize: number;
  readTimeMs: number;
  convertTimeMs: number;
  renderTimeMs: number;
  totalTimeMs: number;
  itemCount: number;
  modelType: 'IFC' | 'FRAG';
}

const statsEl = document.getElementById('stats-content')!;
const logEl = document.getElementById('log-output')!;
const exportFragBtn = document.getElementById('export-frag-btn') as HTMLButtonElement;
const container = document.getElementById('viewport') as HTMLDivElement;

function log(msg: string, tone: 'ok' | 'err' | 'info' = 'info') {
  const line = document.createElement('div');
  line.className = `status-${tone}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
  console.log(`[SPIKE] ${msg}`);
}

function updateStatsUI(m: LoadMetrics) {
  statsEl.innerHTML = `
    <div><strong>Mô hình:</strong> ${m.filename} (${m.modelType})</div>
    <div><strong>Kích thước:</strong> ${(m.filesize / 1024).toFixed(1)} KB</div>
    <div><strong>Đọc file:</strong> ${m.readTimeMs.toFixed(1)} ms</div>
    <div><strong>Convert:</strong> ${m.convertTimeMs.toFixed(1)} ms</div>
    <div><strong>Render 3D:</strong> ${m.renderTimeMs.toFixed(1)} ms</div>
    <div><strong>Tổng thời gian:</strong> <span class="badge">${m.totalTimeMs.toFixed(1)} ms</span></div>
    <div><strong>Số Local IDs:</strong> ${m.itemCount}</div>
  `;
}

// 1. Initialize That Open Components & World
log('Khởi tạo That Open Components...', 'info');
const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);

const world = worlds.create<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBC.SimpleRenderer
>();

world.scene = new OBC.SimpleScene(components);
world.renderer = new OBC.SimpleRenderer(components, container);
world.camera = new OBC.OrthoPerspectiveCamera(components);

components.init();

world.scene.setup({
  backgroundColor: new THREE.Color(0x181c20),
});

// Setup camera controls
world.camera.controls.setLookAt(15, 15, 15, 0, 0, 0);

// Add a subtle grid
const gridHelper = new THREE.GridHelper(50, 50, 0xf97316, 0x2d333b);
gridHelper.position.y = -0.01;
world.scene.three.add(gridHelper);

// 2. Setup FragmentsManager with LOCAL Worker
const fragments = components.get(OBC.FragmentsManager);
const workerUrl = new URL('./thatopen/worker.mjs', window.location.href).href;
log(`Khởi tạo FragmentsManager với local worker: ${workerUrl}`, 'info');

let activeModel: FragmentsModel | null = null;

async function initEngine() {
  await fragments.init(workerUrl);
  log('FragmentsManager worker đã sẵn sàng.', 'ok');

  world.camera.controls.addEventListener('update', () => {
    fragments.core.update();
  });

  fragments.list.onItemSet.add(({ value: model }) => {
    model.useCamera(world.camera.three);
    world.scene.three.add(model.object);
    fragments.core.update(true);
  });

  // 3. Setup IfcLoader with LOCAL WASM
  const ifcLoader = components.get(OBC.IfcLoader);
  const wasmDir = new URL('./thatopen/', window.location.href).href;
  log(`Cấu hình IfcLoader với local WASM: ${wasmDir}`, 'info');

  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: {
      path: wasmDir,
      absolute: true,
    },
  });
  log('IfcLoader cấu hình hoàn tất (Local WASM, không dùng CDN).', 'ok');
}

await initEngine();

// Load IFC from Uint8Array
async function loadIfcBuffer(buffer: Uint8Array, filename: string) {
  try {
    log(`Bắt đầu xử lý IFC: ${filename} (${buffer.byteLength} bytes)...`, 'info');
    const ifcLoader = components.get(OBC.IfcLoader);

    // Dispose old models if any
    for (const [, oldModel] of fragments.list) {
      world.scene.three.remove(oldModel.object);
      oldModel.dispose();
    }
    fragments.list.clear();

    const tConvertStart = performance.now();
    const model = await ifcLoader.load(buffer, false, filename);
    const convertTimeMs = performance.now() - tConvertStart;

    const tRenderStart = performance.now();
    activeModel = model;
    world.scene.three.add(model.object);
    fragments.core.update(true);

    // Fit camera
    const bbox = model.box;
    if (bbox && !bbox.isEmpty()) {
      world.camera.controls.fitToBox(bbox, true);
    }
    const renderTimeMs = performance.now() - tRenderStart;

    const localIds = await model.getLocalIds();
    const totalTimeMs = convertTimeMs + renderTimeMs;

    log(`Đã hiển thị ${filename}: ${localIds.length} items (Convert: ${convertTimeMs.toFixed(1)}ms, Render: ${renderTimeMs.toFixed(1)}ms)`, 'ok');

    updateStatsUI({
      filename,
      filesize: buffer.byteLength,
      readTimeMs: 0,
      convertTimeMs,
      renderTimeMs,
      totalTimeMs,
      itemCount: localIds.length,
      modelType: 'IFC',
    });

    exportFragBtn.disabled = false;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log(`Lỗi khi load IFC: ${errorMsg}`, 'err');
    console.error(err);
  }
}

// Load .frag buffer
async function loadFragBuffer(buffer: Uint8Array, filename: string) {
  try {
    log(`Bắt đầu nạp file .frag: ${filename} (${buffer.byteLength} bytes)...`, 'info');
    const tStart = performance.now();

    for (const [, oldModel] of fragments.list) {
      world.scene.three.remove(oldModel.object);
      oldModel.dispose();
    }
    fragments.list.clear();

    const model = await fragments.core.load(buffer, { modelId: filename });
    const convertTimeMs = performance.now() - tStart;

    const tRenderStart = performance.now();
    activeModel = model;
    world.scene.three.add(model.object);
    fragments.core.update(true);

    const bbox = model.box;
    if (bbox && !bbox.isEmpty()) {
      world.camera.controls.fitToBox(bbox, true);
    }
    const renderTimeMs = performance.now() - tRenderStart;
    const localIds = await model.getLocalIds();
    const totalTimeMs = convertTimeMs + renderTimeMs;

    log(`Đã nạp .frag ${filename}: ${localIds.length} items (Load: ${convertTimeMs.toFixed(1)}ms, Render: ${renderTimeMs.toFixed(1)}ms)`, 'ok');

    updateStatsUI({
      filename,
      filesize: buffer.byteLength,
      readTimeMs: 0,
      convertTimeMs,
      renderTimeMs,
      totalTimeMs,
      itemCount: localIds.length,
      modelType: 'FRAG',
    });

    exportFragBtn.disabled = false;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log(`Lỗi khi nạp .frag: ${errorMsg}`, 'err');
    console.error(err);
  }
}

// UI Event Handlers
const fileInput = document.getElementById('ifc-file-input') as HTMLInputElement;
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const tReadStart = performance.now();
  const arrayBuffer = await file.arrayBuffer();
  const readTimeMs = performance.now() - tReadStart;
  log(`Đã đọc ${file.name} từ đĩa trong ${readTimeMs.toFixed(1)}ms`, 'info');
  await loadIfcBuffer(new Uint8Array(arrayBuffer), file.name);
});

const fragFileInput = document.getElementById('frag-file-input') as HTMLInputElement;
fragFileInput.addEventListener('change', async () => {
  const file = fragFileInput.files?.[0];
  if (!file) return;
  const arrayBuffer = await file.arrayBuffer();
  await loadFragBuffer(new Uint8Array(arrayBuffer), file.name);
});

async function loadSampleUrl(url: string, name: string) {
  try {
    log(`Tải file mẫu từ ${url}...`, 'info');
    const t0 = performance.now();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.arrayBuffer();
    const readTimeMs = performance.now() - t0;
    log(`Tải xong ${name} trong ${readTimeMs.toFixed(1)}ms`, 'info');
    await loadIfcBuffer(new Uint8Array(data), name);
  } catch (e) {
    log(`Lỗi tải file mẫu: ${e instanceof Error ? e.message : String(e)}`, 'err');
  }
}

document.getElementById('load-sample-arch')?.addEventListener('click', () => {
  const url = new URL('./samples/building-arch-2x3.ifc', window.location.href).href;
  loadSampleUrl(url, 'building-arch-2x3.ifc');
});

document.getElementById('load-sample-struct')?.addEventListener('click', () => {
  const url = new URL('./samples/building-struct-2x3.ifc', window.location.href).href;
  loadSampleUrl(url, 'building-struct-2x3.ifc');
});

exportFragBtn.addEventListener('click', async () => {
  if (!activeModel) {
    log('Không có mô hình nào đang mở để xuất .frag', 'err');
    return;
  }
  try {
    log('Đang xuất Fragments model ra buffer...', 'info');
    const t0 = performance.now();
    const fragBuffer = await activeModel.getBuffer(false);
    const exportTime = performance.now() - t0;
    log(`Xuất .frag xong (${fragBuffer.byteLength} bytes) trong ${exportTime.toFixed(1)}ms`, 'ok');

    const blob = new Blob([fragBuffer], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${activeModel.modelId || 'model'}.frag`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (e) {
    log(`Lỗi xuất .frag: ${e instanceof Error ? e.message : String(e)}`, 'err');
  }
});

// Resize handler
window.addEventListener('resize', () => {
  world.renderer?.resize();
  world.camera.updateAspect();
});

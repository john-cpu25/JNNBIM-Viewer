import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..'); // apps/Jnn.Web
const distDir = path.resolve(webRoot, 'dist');
const jnnBimViewerRoot = path.resolve(webRoot, '../..'); // JNN-BIM-Viewer
const topRepoRoot = path.resolve(webRoot, '../../..'); // JNNViewer
const samplesLocalDir = path.resolve(jnnBimViewerRoot, 'samples-local');
const publicSamplesDir = path.resolve(webRoot, 'public/samples');
const reviewFilesDir = path.resolve(topRepoRoot, 'TODO/2_Review/MOC1_files');
const rawLogPath = path.resolve(reviewFilesDir, 'perf-raw.txt');

if (!fs.existsSync(reviewFilesDir)) {
  fs.mkdirSync(reviewFilesDir, { recursive: true });
}

const logStream = fs.createWriteStream(rawLogPath, { flags: 'w', encoding: 'utf-8' });

function log(msg = '') {
  console.log(msg);
  logStream.write(msg + '\n');
}

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.ifc': 'text/plain',
  '.frag': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
});

const PORT = 4188;

server.listen(PORT, async () => {
  log('========================================================================');
  log(`  JNN BIM VIEWER — MỐC 1: BENCHMARK HIỆU NĂNG THỰC TẾ (REAL MEASUREMENTS)`);
  log(`  Thời gian thực thi: ${new Date().toISOString()}`);
  log(`  Nền tảng: Node.js ${process.version} | Chromium (SwiftShader WebGL2)`);
  log('========================================================================\n');

  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  const testFiles = [
    {
      name: 'building-arch-2x3.ifc',
      group: 'Nhóm 1: Nhỏ (< 5 MB)',
      path: path.join(samplesLocalDir, 'building-arch-2x3.ifc'),
      fallbackPath: path.join(publicSamplesDir, 'building-arch-2x3.ifc'),
      ifcOpenShellProducts: 19,
      ifcOpenShellPhysical: 14,
    },
    {
      name: 'building-struct-2x3.ifc',
      group: 'Nhóm 1: Nhỏ (< 5 MB)',
      path: path.join(samplesLocalDir, 'building-struct-2x3.ifc'),
      fallbackPath: path.join(publicSamplesDir, 'building-struct-2x3.ifc'),
      ifcOpenShellProducts: 20,
      ifcOpenShellPhysical: 17,
    },
    {
      name: 'clinic-arch.ifc',
      group: 'Nhóm 2: Vừa (10 – 25 MB)',
      path: path.join(samplesLocalDir, 'clinic-arch.ifc'),
      ifcOpenShellProducts: 3298,
      ifcOpenShellPhysical: 2895,
    },
    {
      name: 'clinic-struct.ifc',
      group: 'Nhóm 2: Vừa (10 – 25 MB)',
      path: path.join(samplesLocalDir, 'clinic-struct.ifc'),
      ifcOpenShellProducts: 1100,
      ifcOpenShellPhysical: 1093,
    },
    {
      name: 'schependomlaan.ifc',
      group: 'Nhóm 3: Lớn (> 50 MB)',
      path: path.join(samplesLocalDir, 'schependomlaan.ifc'),
      ifcOpenShellProducts: 3508,
      ifcOpenShellPhysical: 3505,
    },
  ];

  const results = [];

  for (const item of testFiles) {
    let filePath = item.path;
    if (!fs.existsSync(filePath) && item.fallbackPath && fs.existsSync(item.fallbackPath)) {
      filePath = item.fallbackPath;
    }
    if (!fs.existsSync(filePath)) {
      log(`[SKIP] Không tìm thấy file: ${item.name} tại ${filePath}`);
      results.push({ ...item, status: 'chưa đo' });
      continue;
    }

    const stat = fs.statSync(filePath);
    const sizeBytes = stat.size;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    const sizeKB = (sizeBytes / 1024).toFixed(1);

    log(`------------------------------------------------------------------------`);
    log(`File: ${item.name} (${item.group})`);
    log(`Kích thước file gốc: ${sizeBytes.toLocaleString()} bytes (${sizeMB} MB / ${sizeKB} KB)`);
    log(`IfcOpenShell đếm được: ${item.ifcOpenShellProducts} IfcProduct (${item.ifcOpenShellPhysical} physical elements)`);

    // 1. Measure Cold Load (Parse IFC) - 3 iterations
    const coldTimes = [];
    let viewerElements = 0;
    let cacheSize = 0;

    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(`http://localhost:${PORT}/?debug=1`);
      await page.waitForSelector('[data-testid="viewer-host"][data-status="ready"]', { timeout: 30000 });

      // Clear IndexedDB cache before cold load
      await page.evaluate(async () => {
        return new Promise((resolve) => {
          const req = indexedDB.open('jnn_ifc_cache', 1);
          req.onsuccess = () => {
            const db = req.result;
            try {
              const tx = db.transaction('cached_models', 'readwrite');
              tx.objectStore('cached_models').clear();
              tx.oncomplete = () => { db.close(); resolve(true); };
              tx.onerror = () => { db.close(); resolve(false); };
            } catch {
              db.close();
              resolve(false);
            }
          };
          req.onerror = () => resolve(false);
        });
      });

      const tStart = performance.now();
      await page.locator('input[data-testid="ifc-file-input"]').setInputFiles(filePath);
      await page.waitForSelector('text=Mở thành công', { timeout: 300000 });
      const tEnd = performance.now();
      const elapsed = Math.round(tEnd - tStart);
      coldTimes.push(elapsed);

      if (run === 1) {
        const debug = await page.evaluate(() => window.__jnn?.viewer?.debugState?.());
        viewerElements = debug?.elementCount ?? 0;

        await page.evaluate(async () => {
          await window.__jnn?.viewer?.waitForCache?.();
        });

        // Query cache size from IndexedDB
        cacheSize = await page.evaluate(async () => {
          return new Promise((resolve) => {
              const req = indexedDB.open('jnn_ifc_cache', 1);
              req.onsuccess = () => {
                const db = req.result;
                try {
                  const tx = db.transaction('cached_models', 'readonly');
                  const store = tx.objectStore('cached_models');
                  const allReq = store.getAll();
                  allReq.onsuccess = () => {
                    const item = allReq.result[0];
                    db.close();
                    resolve(item?.fragBuffer?.byteLength ?? 0);
                  };
                  allReq.onerror = () => { db.close(); resolve(0); };
                } catch {
                  db.close();
                  resolve(0);
                }
              };
            });
        });
      }

      log(`  Cold load #${run}: ${elapsed} ms`);
      await context.close();
    }

    const avgCold = Math.round(coldTimes.reduce((a, b) => a + b, 0) / coldTimes.length);
    log(`  => Cold load trung bình (3 lần): ${avgCold} ms`);
    log(`  Số cấu kiện Viewer hiển thị: ${viewerElements}`);
    log(`  Dung lượng cache nhị phân (.frag): ${(cacheSize / 1024).toFixed(1)} KB (${cacheSize.toLocaleString()} bytes)`);

    // 2. Measure Hot Load (From IndexedDB Cache) - 3 iterations
    const hotTimes = [];
    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(`http://localhost:${PORT}/?debug=1`);
      await page.waitForSelector('[data-testid="viewer-host"][data-status="ready"]', { timeout: 30000 });

      // First load to populate cache
      await page.locator('input[data-testid="ifc-file-input"]').setInputFiles(filePath);
      await page.waitForSelector('text=Mở thành công', { timeout: 300000 });

      // Await async cache write
      await page.evaluate(async () => {
        await window.__jnn?.viewer?.waitForCache?.();
      });

      // Second load: Reload page and open same file (hits IndexedDB cache!)
      await page.reload();
      await page.waitForSelector('[data-testid="viewer-host"][data-status="ready"]', { timeout: 30000 });

      const tStart = performance.now();
      await page.locator('input[data-testid="ifc-file-input"]').setInputFiles(filePath);
      await page.waitForSelector('text=từ cache IndexedDB', { timeout: 60000 });
      const tEnd = performance.now();
      const elapsed = Math.round(tEnd - tStart);
      hotTimes.push(elapsed);

      log(`  Hot load #${run}: ${elapsed} ms`);
      await context.close();
    }

    const avgHot = Math.round(hotTimes.reduce((a, b) => a + b, 0) / hotTimes.length);
    const speedup = (avgCold / avgHot).toFixed(1);
    log(`  => Hot load trung bình (3 lần): ${avgHot} ms`);
    log(`  => Tỷ lệ tăng tốc Cache: ${speedup}x (Mục tiêu ≥ 3.0x: ${Number(speedup) >= 3.0 ? 'ĐẠT' : 'CHƯA ĐẠT'})\n`);

    results.push({
      ...item,
      sizeBytes,
      sizeMB,
      sizeKB,
      coldTimes,
      avgCold,
      hotTimes,
      avgHot,
      speedup,
      viewerElements,
      cacheSize,
    });
  }

  // 3. Federated Pair Benchmark: Clinic_A (13MB) + Clinic_S (19MB)
  const archFile = path.join(samplesLocalDir, 'clinic-arch.ifc');
  const structFile = path.join(samplesLocalDir, 'clinic-struct.ifc');

  if (fs.existsSync(archFile) && fs.existsSync(structFile)) {
    log(`------------------------------------------------------------------------`);
    log(`Mô hình Federated: Clinic_A (13 MB) + Clinic_S (19 MB)`);
    log(`Tổng kích thước 2 file IFC: ${(fs.statSync(archFile).size + fs.statSync(structFile).size).toLocaleString()} bytes (31.08 MB)`);

    const fedColdTimes = [];
    let totalElements = 0;

    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(`http://localhost:${PORT}/?debug=1`);
      await page.waitForSelector('[data-testid="viewer-host"][data-status="ready"]', { timeout: 30000 });

      // Clear cache
      await page.evaluate(async () => {
        return new Promise((resolve) => {
          const req = indexedDB.open('jnn_ifc_cache', 1);
          req.onsuccess = () => {
            const db = req.result;
            try {
              const tx = db.transaction('cached_models', 'readwrite');
              tx.objectStore('cached_models').clear();
              tx.oncomplete = () => { db.close(); resolve(true); };
              tx.onerror = () => { db.close(); resolve(false); };
            } catch {
              db.close();
              resolve(false);
            }
          };
          req.onerror = () => resolve(false);
        });
      });

      const tStart = performance.now();
      await page.locator('input[data-testid="ifc-file-input"]').setInputFiles(archFile);
      await page.waitForSelector('text=Mở thành công', { timeout: 300000 });
      await page.locator('input[data-testid="append-ifc-input"]').setInputFiles(structFile);
      await page.waitForSelector('text=Đã thêm mô hình', { timeout: 300000 });
      const tEnd = performance.now();
      const elapsed = Math.round(tEnd - tStart);
      fedColdTimes.push(elapsed);

      if (run === 1) {
        const debug = await page.evaluate(() => window.__jnn?.viewer?.debugState?.());
        totalElements = debug?.elementCount ?? 0;
      }

      log(`  Federated Cold load #${run}: ${elapsed} ms`);
      await context.close();
    }

    const avgFed = Math.round(fedColdTimes.reduce((a, b) => a + b, 0) / fedColdTimes.length);
    log(`  => Federated nạp 2 model trung bình: ${avgFed} ms`);
    log(`  Tổng số cấu kiện federated hiển thị: ${totalElements} cấu kiện`);
  }

  log('\n========================================================================');
  log('  BENCHMARK HOÀN TẤT. KẾT QUẢ ĐÃ ĐƯỢC GHI VÀO TODO/2_Review/MOC1_files/perf-raw.txt');
  log('========================================================================');

  await browser.close();
  server.close();
  logStream.end();
});

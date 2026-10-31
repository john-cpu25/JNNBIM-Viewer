import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(webRoot, 'dist');
const jnnBimViewerRoot = path.resolve(webRoot, '../..');
const towerPath = path.resolve(jnnBimViewerRoot, 'samples-local/HRDP_SAI_DD_STR_RVT_5CT1_NGUYEN3_nhan.ifc');

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

const PORT = 4199;

server.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Tower model path: ${towerPath}`);
  const stat = fs.statSync(towerPath);
  console.log(`Tower file size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB (${stat.size} bytes)`);

  const browser = await chromium.launch({
    headless: false, // real window with hardware acceleration
    args: ['--enable-gpu', '--ignore-gpu-blocklist'],
  });

  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  console.log('Navigating to app...');
  await page.goto(`http://localhost:${PORT}/?debug=1`);

  console.log('Uploading tower IFC...');
  const fileInput = page.locator('[data-testid="ifc-file-input"]');
  await fileInput.setInputFiles(towerPath);

  console.log('Waiting for model to load...');
  await page.waitForFunction(
    () => {
      const state = window.__jnn?.getState();
      const model = state?.models?.[0];
      return model && model.elementCount > 0 && model.name !== 'Chưa có mô hình';
    },
    { timeout: 180000 }
  );

  console.log('Model loaded! Waiting for initial rendering to settle...');
  await page.waitForTimeout(3000);

  const modelInfo = await page.evaluate(() => {
    const state = window.__jnn?.getState();
    const model = state?.models?.[0];
    return {
      name: model?.name,
      elementCount: model?.elementCount,
      bounds: window.__jnn?.viewer?.getBounds?.(),
    };
  });
  console.log('Loaded Model Info:', JSON.stringify(modelInfo, null, 2));

  // Helper to run drag rotation and record rAF deltas
  async function runOrbitTest(name, dragSteps = 60, durationMs = 2000, startX = 800, startY = 450, endX = 350, endY = 450, button = 'left') {
    const camBefore = await page.evaluate(() => window.__jnn.viewer.getCamera());
    // Install rAF recorder
    await page.evaluate(() => {
      window.__frameDeltas = [];
      let last = performance.now();
      window.__recordActive = true;
      function onFrame() {
        if (!window.__recordActive) return;
        const now = performance.now();
        window.__frameDeltas.push(now - last);
        last = now;
        requestAnimationFrame(onFrame);
      }
      requestAnimationFrame(onFrame);
    });

    // Perform Shift + drag
    await page.keyboard.down('Shift');
    await page.mouse.move(startX, startY);
    await page.mouse.down({ button });

    const stepDelay = durationMs / dragSteps;
    for (let i = 1; i <= dragSteps; i++) {
      const x = startX + ((endX - startX) * i) / dragSteps;
      const y = startY + ((endY - startY) * i) / dragSteps;
      await page.mouse.move(x, y);
      await page.waitForTimeout(stepDelay);
    }

    await page.mouse.up({ button });
    await page.keyboard.up('Shift');

    // Wait a brief moment to capture any trailing frame
    await page.waitForTimeout(100);

    const deltas = await page.evaluate(() => {
      window.__recordActive = false;
      return window.__frameDeltas;
    });

    // Discard the very first frame delta which can be setup delay
    const cleanDeltas = deltas.slice(1);
    const totalTime = cleanDeltas.reduce((a, b) => a + b, 0);
    const avgFps = cleanDeltas.length / (totalTime / 1000);
    const maxFrame = Math.max(...cleanDeltas);
    const over100ms = cleanDeltas.filter((d) => d > 100).length;

    const camAfter = await page.evaluate(() => window.__jnn.viewer.getCamera());
    const moved = Math.hypot(
      camAfter.value.position[0] - camBefore.value.position[0],
      camAfter.value.position[1] - camBefore.value.position[1],
      camAfter.value.position[2] - camBefore.value.position[2]
    );

    console.log(`[${name}] Moved: ${moved.toFixed(3)}, Frames: ${cleanDeltas.length}, Total: ${totalTime.toFixed(1)}ms, Avg FPS: ${avgFps.toFixed(1)}, Max: ${maxFrame.toFixed(1)}ms, >100ms: ${over100ms}`);
    return { name, moved, frames: cleanDeltas.length, avgFps, maxFrame, over100ms, deltas: cleanDeltas };
  }

  console.log('\n--- Kịch bản (a): Shift + kéo xoay toàn tháp (3 lần) ---');
  const runsA = [];
  for (let i = 1; i <= 3; i++) {
    await page.waitForTimeout(1500);
    const res = await runOrbitTest(`Kịch bản A - Lần ${i}`, 60, 2000, 850, 450, 350, 450);
    runsA.push(res);
  }

  console.log('\n--- Zoom sát một tầng ---');
  // Zoom in towards model
  await page.mouse.move(650, 450);
  for (let z = 0; z < 8; z++) {
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(2000);

  console.log('\n--- Kịch bản (b): Zoom sát một tầng rồi xoay (3 lần) ---');
  const runsB = [];
  for (let i = 1; i <= 3; i++) {
    await page.waitForTimeout(1500);
    const res = await runOrbitTest(`Kịch bản B - Lần ${i}`, 60, 2000, 800, 450, 400, 450);
    runsB.push(res);
  }

  const avgAFps = (runsA.reduce((s, r) => s + r.avgFps, 0) / runsA.length).toFixed(1);
  const maxAFrame = Math.max(...runsA.map((r) => r.maxFrame)).toFixed(1);
  const totalAOver100 = runsA.reduce((s, r) => s + r.over100ms, 0);

  const avgBFps = (runsB.reduce((s, r) => s + r.avgFps, 0) / runsB.length).toFixed(1);
  const maxBFrame = Math.max(...runsB.map((r) => r.maxFrame)).toFixed(1);
  const totalBOver100 = runsB.reduce((s, r) => s + r.over100ms, 0);

  console.log('\n======================================================');
  console.log('TỔNG HỢP SỐ LIỆU ĐO:');
  console.log(`Kịch bản (a) Xoay toàn tháp: Avg FPS = ${avgAFps}, Max Frame = ${maxAFrame} ms, Tổng frames >100ms = ${totalAOver100}`);
  console.log(`Kịch bản (b) Zoom sát rồi xoay: Avg FPS = ${avgBFps}, Max Frame = ${maxBFrame} ms, Tổng frames >100ms = ${totalBOver100}`);
  console.log('======================================================');

  // Save after-fix JSON
  const outputPath = path.resolve(webRoot, 'scripts/results/benchmark-orbit-after-fix.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        model: modelInfo,
        fileSizeMb: (stat.size / (1024 * 1024)).toFixed(2),
        runsA,
        runsB,
        summaryA: { avgFps: avgAFps, maxFrame: maxAFrame, over100ms: totalAOver100 },
        summaryB: { avgFps: avgBFps, maxFrame: maxBFrame, over100ms: totalBOver100 },
      },
      null,
      2
    )
  );
  console.log(`Saved baseline to ${outputPath}`);

  await browser.close();
  server.close();
  process.exit(0);
});

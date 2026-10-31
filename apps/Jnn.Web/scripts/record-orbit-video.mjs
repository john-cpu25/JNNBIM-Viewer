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
const topRepoRoot = path.resolve(webRoot, '../../..');
const towerPath = path.resolve(jnnBimViewerRoot, 'samples-local/HRDP_SAI_DD_STR_RVT_5CT1_NGUYEN3_nhan.ifc');
const videoDir = path.resolve(topRepoRoot, 'Video');

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
  fs.mkdirSync(videoDir, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    args: ['--enable-gpu', '--ignore-gpu-blocklist'],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1400, height: 900 },
    },
  });

  const page = await context.newPage();
  console.log('Navigating to app with ?debug=1...');
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

  // Helper for circular smooth orbit drag
  async function performCircleOrbit(centerX = 750, centerY = 450, radius = 250, steps = 100, durationMs = 3500) {
    await page.keyboard.down('Shift');
    const startX = centerX + radius;
    const startY = centerY;
    await page.mouse.move(startX, startY);
    await page.mouse.down({ button: 'left' });

    const stepDelay = durationMs / steps;
    for (let i = 1; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * (radius * 0.4);
      await page.mouse.move(x, y);
      await page.waitForTimeout(stepDelay);
    }

    await page.mouse.up({ button: 'left' });
    await page.keyboard.up('Shift');
  }

  console.log('Recording Video Action 1: Orbit whole tower...');
  await performCircleOrbit(750, 450, 280, 80, 3000);
  await page.waitForTimeout(1500);

  console.log('Recording Video Action 2: Click in empty space on the left to test F2 pivot fallback...');
  // Click in empty space at x: 250, y: 350 (outside model) with Shift
  await page.keyboard.down('Shift');
  await page.mouse.move(250, 350);
  await page.mouse.down({ button: 'left' });
  // Drag across
  for (let i = 0; i < 40; i++) {
    await page.mouse.move(250 + i * 8, 350);
    await page.waitForTimeout(30);
  }
  await page.mouse.up({ button: 'left' });
  await page.keyboard.up('Shift');
  await page.waitForTimeout(1500);

  console.log('Recording Video Action 3: Zoom into a storey and orbit...');
  await page.mouse.move(700, 450);
  for (let z = 0; z < 8; z++) {
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(1500);

  // Orbit close up
  await performCircleOrbit(700, 450, 180, 70, 2500);
  await page.waitForTimeout(2000);

  console.log('Finishing video recording...');
  const video = page.video();
  await page.close();
  await context.close();

  if (video) {
    const videoPath = await video.path();
    const finalPath = path.resolve(videoDir, 'Recording_2026-10-31_orbit_smooth.webm');
    fs.copyFileSync(videoPath, finalPath);
    console.log(`Video saved to: ${finalPath} (${fs.statSync(finalPath).size} bytes)`);
  }

  await browser.close();
  server.close();
  console.log('Video recording finished successfully!');
  process.exit(0);
});

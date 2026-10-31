import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(webRoot, 'dist');
const jnnViewerRoot = path.resolve(webRoot, '../../..');
const targetVideoDir = path.resolve(jnnViewerRoot, 'TODO/2_Review/MOC5_files');

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

const PORT = 4198;

server.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  fs.mkdirSync(targetVideoDir, { recursive: true });

  const tempVideoDir = path.resolve(webRoot, 'temp-video');
  fs.mkdirSync(tempVideoDir, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    args: ['--enable-gpu', '--ignore-gpu-blocklist'],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    recordVideo: {
      dir: tempVideoDir,
      size: { width: 1400, height: 900 },
    },
  });

  const page = await context.newPage();
  console.log('Navigating to app with ?debug=1...');
  await page.goto(`http://localhost:${PORT}/?debug=1`);

  console.log('Waiting for viewer-host ready...');
  await page.waitForSelector('[data-testid="viewer-host"][data-status="ready"]', { timeout: 20000 });

  console.log('Clicking sample Architecture button...');
  const archBtn = page.getByRole('button', { name: /Kiến trúc \(90 KB\)/i });
  await archBtn.click();

  console.log('Waiting for model to load and render...');
  await page.waitForSelector('text=Mở thành công', { timeout: 50000 });
  await page.waitForTimeout(2000);

  // --- DEMO 1: Ctrl + Click multi-select & Ctrl + A ---
  console.log('Action 1: Multi-select with tree items and Ctrl+click...');
  const searchInput = page.getByLabel('Search elements');
  await searchInput.fill('wall');
  await page.waitForTimeout(600);

  const treeElements = page.getByTestId('tree-element');
  await treeElements.first().waitFor({ state: 'visible', timeout: 10000 });

  await treeElements.nth(0).click();
  await page.waitForTimeout(800);

  await treeElements.nth(1).click({ modifiers: ['Control'] });
  await page.waitForTimeout(1000);

  console.log('Action 1b: Ctrl+A to select all visible...');
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(1200);

  console.log('Action 1c: Esc to clear selection...');
  await page.keyboard.press('Escape');
  await searchInput.fill('');
  await page.waitForTimeout(800);

  // --- DEMO 2: Box Selection (Window vs Crossing) ---
  console.log('Action 2: Window box select (left -> right)...');
  await page.mouse.move(500, 320);
  await page.mouse.down({ button: 'left' });
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(500 + i * 14, 320 + i * 10);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(400);
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(1200);

  console.log('Action 2b: Crossing box select (right -> left)...');
  await page.mouse.move(820, 520);
  await page.mouse.down({ button: 'left' });
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(820 - i * 16, 520 - i * 10);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(400);
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(1200);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // --- DEMO 3: Dimension Measurement (Tool M) ---
  console.log('Action 3: Open MeasurePanel with key M...');
  await page.keyboard.press('m');
  await page.waitForTimeout(800);

  console.log('Action 3b: Find 2 points on model geometry using pickAt and click...');
  const points = await page.evaluate(async () => {
    const v = window.__jnn?.viewer;
    const canvas = document.querySelector('[data-testid="viewer-canvas"]');
    if (!canvas || !v) return null;
    const rect = canvas.getBoundingClientRect();
    const hits = [];
    for (let y = rect.top + 100; y < rect.bottom - 100; y += 30) {
      for (let x = rect.left + 200; x < rect.right - 200; x += 30) {
        const h = await v.pickAt(x, y);
        if (h && h.point) {
          hits.push({ x: Math.round(x), y: Math.round(y), point: [h.point[0], h.point[1], h.point[2]] });
        }
      }
    }
    if (hits.length < 2) return null;
    const p1 = hits[0];
    let p2 = hits[hits.length - 1];
    for (let i = hits.length - 1; i >= 1; i--) {
      const d = Math.hypot(hits[i].point[0] - p1.point[0], hits[i].point[1] - p1.point[1], hits[i].point[2] - p1.point[2]);
      if (d >= 0.5) {
        p2 = hits[i];
        break;
      }
    }
    return { p1, p2 };
  });

  if (points) {
    const { p1, p2 } = points;
    console.log(`Clicking p1 at (${p1.x}, ${p1.y}) and p2 at (${p2.x}, ${p2.y})...`);
    await page.mouse.move(p1.x, p1.y, { steps: 5 });
    await page.waitForTimeout(200);
    await page.mouse.click(p1.x, p1.y);
    await page.waitForTimeout(400);

    await page.mouse.move(p2.x, p2.y, { steps: 5 });
    await page.waitForTimeout(400);
    await page.mouse.click(p2.x, p2.y);
    await page.waitForTimeout(1500);
  }

  console.log('Action 3c: Change unit to m...');
  const unitMRadio = page.getByRole('radio', { name: 'm', exact: true });
  if (await unitMRadio.isVisible()) {
    await unitMRadio.click();
    await page.waitForTimeout(1200);
  }

  console.log('Action 3d: Clear measurements (if any) and exit...');
  const clearBtn = page.getByTestId('measure-clear-btn');
  if ((await clearBtn.isVisible()) && !(await clearBtn.isDisabled())) {
    await clearBtn.click();
    await page.waitForTimeout(600);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // --- DEMO 4: Saved Views ---
  console.log('Action 4: Saved views panel...');
  const viewsTab = page.getByTestId('tab-views-btn');
  if (await viewsTab.isVisible()) {
    await viewsTab.click();
    await page.waitForTimeout(1000);

    const addViewBtn = page.locator('[data-testid="save-view-btn"]');
    if (await addViewBtn.isVisible()) {
      await addViewBtn.click();
      console.log('Waiting for saved view card with thumbnail image...');
      await page.waitForSelector('[data-testid="saved-view-card"] img', { timeout: 10000 });
      await page.waitForTimeout(2000);

      // Orbit slightly
      console.log('Orbiting camera slightly to demonstrate restore...');
      await page.keyboard.down('Shift');
      await page.mouse.move(650, 400);
      await page.mouse.down({ button: 'left' });
      for (let i = 1; i <= 20; i++) {
        await page.mouse.move(650 + i * 10, 400 + i * 4);
        await page.waitForTimeout(20);
      }
      await page.mouse.up({ button: 'left' });
      await page.keyboard.up('Shift');
      await page.waitForTimeout(1200);

      // Restore saved view
      console.log('Clicking saved view card to restore viewpoint...');
      const viewItem = page.locator('[data-testid="saved-view-card"]').first();
      if (await viewItem.isVisible()) {
        await viewItem.click();
        await page.waitForTimeout(2000);
      }
    }
  }

  // --- DEMO 5: First-Person Walk Mode ---
  console.log('Action 5: First-person Walk mode...');
  const walkBtn = page.locator('[data-testid="toggle-walk-btn"]');
  if (await walkBtn.isVisible()) {
    await walkBtn.click();
    await page.waitForTimeout(800);

    // Walk forward W
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1000);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(500);

    // Walk right D
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(600);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(500);

    // Exit walk mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }

  console.log('Finishing video recording...');
  const video = page.video();
  await page.close();
  await context.close();

  if (video) {
    const videoPath = await video.path();
    const finalPath = path.resolve(targetVideoDir, 'moc5_demo.webm');
    fs.copyFileSync(videoPath, finalPath);
    console.log(`Demo video saved to: ${finalPath} (${fs.statSync(finalPath).size} bytes)`);
  }

  await browser.close();
  server.close();

  try {
    fs.rmSync(tempVideoDir, { recursive: true, force: true });
  } catch {}

  console.log('Mốc 5 demo video recording finished successfully!');
  process.exit(0);
});

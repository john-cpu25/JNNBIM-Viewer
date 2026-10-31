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

  console.log('Action 3b: Click 2 points on canvas...');
  const canvas = page.getByTestId('viewer-canvas');
  const box = await canvas.boundingBox();
  if (box) {
    const pt1X = box.x + box.width * 0.45;
    const pt1Y = box.y + box.height * 0.45;
    const pt2X = box.x + box.width * 0.55;
    const pt2Y = box.y + box.height * 0.55;

    await page.mouse.click(pt1X, pt1Y);
    await page.waitForTimeout(500);
    await page.mouse.click(pt2X, pt2Y);
    await page.waitForTimeout(1000);
  }

  console.log('Action 3c: Change unit to m...');
  const unitMBtn = page.getByRole('button', { name: 'm', exact: true });
  if (await unitMBtn.isVisible()) {
    await unitMBtn.click();
    await page.waitForTimeout(800);
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
    await page.waitForTimeout(800);

    const addViewBtn = page.locator('[data-testid="add-view-btn"]');
    if (await addViewBtn.isVisible()) {
      await addViewBtn.click();
      await page.waitForTimeout(1200);

      // Orbit slightly
      await page.keyboard.down('Shift');
      await page.mouse.move(650, 400);
      await page.mouse.down({ button: 'left' });
      for (let i = 1; i <= 15; i++) {
        await page.mouse.move(650 + i * 8, 400 + i * 2);
        await page.waitForTimeout(20);
      }
      await page.mouse.up({ button: 'left' });
      await page.keyboard.up('Shift');
      await page.waitForTimeout(1000);

      // Restore saved view
      const viewItem = page.locator('[data-testid="saved-view-item"]').first();
      if (await viewItem.isVisible()) {
        await viewItem.click();
        await page.waitForTimeout(1500);
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

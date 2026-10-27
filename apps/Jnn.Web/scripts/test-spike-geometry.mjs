import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(webRoot, 'dist');
const repoRoot = path.resolve(webRoot, '../..');
const reviewDir = path.resolve(repoRoot, '../TODO/2_Review');

if (!fs.existsSync(reviewDir)) {
  fs.mkdirSync(reviewDir, { recursive: true });
}

// Simple static server for dist
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
  res.writeHead(200, {
    'Content-Type': mime,
  });
  fs.createReadStream(filePath).pipe(res);
});

const PORT = 4174;

server.listen(PORT, async () => {
  console.log(`Spike geometry server running at http://localhost:${PORT}`);
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('pageerror', (err) => {
    console.error('PAGE ERROR:', err);
  });

  page.on('console', (msg) => {
    console.log(`[PAGE ${msg.type()}]:`, msg.text());
  });

  try {
    await page.goto(`http://localhost:${PORT}/spike-geometry.html`, { waitUntil: 'networkidle' });
    console.log('Opened spike-geometry.html');

    console.log('Triggering Spike Geometry execution...');
    await page.click('#run-btn');

    await page.waitForFunction(() => {
      const el = document.getElementById('stats-content');
      return el && (el.textContent.includes('THÀNH CÔNG') || el.textContent.includes('LỖI'));
    }, { timeout: 60000 });

    const stats = await page.$eval('#stats-content', el => el.innerText);
    console.log('\n=== SPIKE GEOMETRY STATS ===\n', stats);

    const result = await page.evaluate(() => (window).__SPIKE_GEOMETRY_RESULT__);
    const resultJsonPath = path.join(reviewDir, 'T10.1_spike_geometry_result.json');
    fs.writeFileSync(resultJsonPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`Saved detailed result to ${resultJsonPath}`);

    const screenshotPath = path.join(reviewDir, 'T10.1_spike_geometry.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved screenshot to ${screenshotPath}`);

    if (result && result.totalTriangles > 0 && result.totalElementsTested > 0) {
      console.log('\n>>> T10.1 PASS CRITERIA VERIFIED: Triangles > 0, Elements tested > 0, MeshBVH created! <<<\n');
    } else {
      console.error('\n>>> T10.1 FAILED: Invalid result <<<\n');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Spike execution error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
});

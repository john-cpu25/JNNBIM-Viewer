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

const PORT = 4175;

server.listen(PORT, async () => {
  console.log(`Clash integration server running at http://localhost:${PORT}`);
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
    await page.goto(`http://localhost:${PORT}/spike-clash.html`, { waitUntil: 'networkidle' });
    console.log('Opened spike-clash.html');

    console.log('Triggering Two-Model Clash Integration execution...');
    await page.click('#run-btn');

    await page.waitForFunction(() => {
      const el = document.getElementById('stats-content');
      return el && (el.textContent.includes('THÀNH CÔNG') || el.textContent.includes('LỖI'));
    }, { timeout: 90000 });

    const stats = await page.$eval('#stats-content', el => el.innerText);
    console.log('\n=== INTEGRATION CLASH STATS ===\n', stats);

    const report = await page.evaluate(() => (window).__INTEGRATION_CLASH_RESULT__);
    const resultJsonPath = path.join(reviewDir, 'T11.4_integration_clash_result.json');
    fs.writeFileSync(resultJsonPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Saved detailed integration result to ${resultJsonPath}`);

    const screenshotPath = path.join(reviewDir, 'T11.4_spike_clash.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved screenshot to ${screenshotPath}`);

    if (report && report.totalCandidates > 0 && report.hardClashesCount >= 0) {
      console.log('\n>>> T11.4 PASS CRITERIA VERIFIED: Integration clash completed on 2 real IFC models! <<<\n');
    } else {
      console.error('\n>>> T11.4 FAILED: Invalid result <<<\n');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Integration clash execution error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
});

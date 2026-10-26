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
const samplesLocalDir = path.resolve(repoRoot, 'samples-local');
const reviewDir = path.resolve(repoRoot, '../TODO/2_Review/T03_files');

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
  console.log('SERVER REQ:', req.method, req.url);
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

const PORT = 4173;

server.listen(PORT, async () => {
  console.log(`Server running at http://localhost:${PORT}`);
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('pageerror', (err) => {
    console.error('PAGE ERROR:', err);
  });

  const cdnRequests = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1') && !url.startsWith('blob:') && !url.startsWith('data:')) {
      cdnRequests.push(url);
    }
  });

  const consoleLogs = [];
  page.on('console', (msg) => {
    console.log(`[PAGE ${msg.type()}]:`, msg.text());
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  try {
    await page.goto(`http://localhost:${PORT}/spike-ifc.html`, { waitUntil: 'networkidle' });
    console.log('Opened spike-ifc.html');

    // 1. Test Small Arch sample
    console.log('Testing Small Arch sample...');
    await page.click('#load-sample-arch');
    await page.waitForFunction(() => {
      const el = document.getElementById('log-output');
      return el && el.textContent.includes('Đã hiển thị building-arch-2x3.ifc');
    }, { timeout: 30000 });

    const statsArch = await page.$eval('#stats-content', el => el.innerText);
    console.log('Arch Stats:\n', statsArch);
    await page.screenshot({ path: path.join(reviewDir, 'spike-arch-sample.png') });

    // 2. Test Small Struct sample
    console.log('Testing Small Struct sample...');
    await page.click('#load-sample-struct');
    await page.waitForFunction(() => {
      const el = document.getElementById('log-output');
      return el && el.textContent.includes('Đã hiển thị building-struct-2x3.ifc');
    }, { timeout: 30000 });

    const statsStruct = await page.$eval('#stats-content', el => el.innerText);
    console.log('Struct Stats:\n', statsStruct);
    await page.screenshot({ path: path.join(reviewDir, 'spike-struct-sample.png') });

    // 3. Test Export .frag & Reload .frag
    console.log('Testing Export .frag...');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#export-frag-btn'),
    ]);
    const fragPath = path.join(reviewDir, 'downloaded-model.frag');
    await download.saveAs(fragPath);
    console.log(`Saved .frag to ${fragPath} (${fs.statSync(fragPath).size} bytes)`);

    console.log('Testing Reload .frag...');
    await page.setInputFiles('#frag-file-input', fragPath);
    await page.waitForFunction(() => {
      const el = document.getElementById('log-output');
      return el && el.textContent.includes('Đã nạp .frag');
    }, { timeout: 30000 });

    const statsFrag = await page.$eval('#stats-content', el => el.innerText);
    console.log('Reload Frag Stats:\n', statsFrag);
    await page.screenshot({ path: path.join(reviewDir, 'spike-reload-frag.png') });

    // 4. Test Medium sample from samples-local (school-str.ifc ~8.6 MB)
    const schoolIfcPath = path.join(samplesLocalDir, 'school-str.ifc');
    if (fs.existsSync(schoolIfcPath)) {
      console.log(`Testing Medium sample: ${schoolIfcPath}...`);
      await page.setInputFiles('#ifc-file-input', schoolIfcPath);
      await page.waitForFunction(() => {
        const el = document.getElementById('log-output');
        return el && el.textContent.includes('Đã hiển thị school-str.ifc');
      }, { timeout: 60000 });

      const statsSchool = await page.$eval('#stats-content', el => el.innerText);
      console.log('School Stats:\n', statsSchool);
      await page.screenshot({ path: path.join(reviewDir, 'spike-school-sample.png') });
    }

    console.log('\n--- CDN Request Check ---');
    console.log(`Total external CDN requests: ${cdnRequests.length}`);
    if (cdnRequests.length > 0) {
      console.error('FAIL: Detected external requests:', cdnRequests);
    } else {
      console.log('PASS: 0 external CDN requests. Pure local offline execution.');
    }

    console.log('\n--- Console Logs Summary ---');
    console.log(`Total console logs: ${consoleLogs.length}`);
    consoleLogs.slice(-10).forEach(l => console.log(' ', l));

    fs.writeFileSync(path.join(reviewDir, 'spike-results.json'), JSON.stringify({
      cdnRequests,
      statsArch,
      statsStruct,
      statsFrag,
      consoleLogsCount: consoleLogs.length,
    }, null, 2), 'utf8');

    console.log('Spike test completed successfully!');
  } catch (err) {
    console.error('Spike test error:', err);
  } finally {
    await browser.close();
    server.close();
  }
});

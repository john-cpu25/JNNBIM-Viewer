import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const destDir = path.resolve(webRoot, 'public/thatopen');

const filesToCopy = [
  {
    src: path.resolve(webRoot, 'node_modules/web-ifc/web-ifc.wasm'),
    dest: path.join(destDir, 'web-ifc.wasm'),
  },
  {
    src: path.resolve(webRoot, 'node_modules/web-ifc/web-ifc-mt.wasm'),
    dest: path.join(destDir, 'web-ifc-mt.wasm'),
  },
  {
    src: path.resolve(webRoot, 'node_modules/@thatopen/fragments/dist/Worker/worker.mjs'),
    dest: path.join(destDir, 'worker.mjs'),
  },
];

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

for (const { src, dest } of filesToCopy) {
  if (!fs.existsSync(src)) {
    console.error(`Missing source file: ${src}`);
    process.exit(1);
  }
  fs.copyFileSync(src, dest);
  const size = fs.statSync(dest).size;
  console.log(`Copied ${path.basename(dest)} (${size} bytes) -> public/thatopen/`);
}

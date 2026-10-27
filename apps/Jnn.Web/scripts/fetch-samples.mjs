#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '../..');
const samplesLocalDir = path.resolve(repoRoot, 'samples-local');
const publicSamplesDir = path.resolve(webRoot, 'public/samples');
const docsPath = path.resolve(repoRoot, 'docs/Sample-Files.md');

const SAMPLES = [
  {
    filename: 'building-arch-2x3.ifc',
    url: 'https://raw.githubusercontent.com/buildingSMART/Certification-datasets/main/IFC%202.3.0.1%20(IFC%202x3%20TC1)/Simple-Scene/Building-Architecture.ifc',
    license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    schema: 'IFC2X3',
    discipline: 'Architecture (Kiến trúc)',
    tier: 'Nhỏ (< 5 MB)',
    copyToPublic: true,
    notes: 'Mô hình kiến trúc tòa nhà đơn giản trong bộ dataset chuẩn buildingSMART Simple-Scene; cùng hệ tọa độ với building-struct-2x3.',
  },
  {
    filename: 'building-struct-2x3.ifc',
    url: 'https://raw.githubusercontent.com/buildingSMART/Certification-datasets/main/IFC%202.3.0.1%20(IFC%202x3%20TC1)/Simple-Scene/Building-Structural.ifc',
    license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    schema: 'IFC2X3',
    discipline: 'Structural (Kết cấu)',
    tier: 'Nhỏ (< 5 MB)',
    copyToPublic: true,
    notes: 'Mô hình kết cấu cùng hệ tọa độ với building-arch-2x3, hoàn hảo để kiểm thử federated multi-model và clash detection.',
  },
  {
    filename: 'building-hvac-2x3.ifc',
    url: 'https://raw.githubusercontent.com/buildingSMART/Certification-datasets/main/IFC%202.3.0.1%20(IFC%202x3%20TC1)/Simple-Scene/Building-Hvac.ifc',
    license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    schema: 'IFC2X3',
    discipline: 'MEP / HVAC (Cơ điện)',
    tier: 'Nhỏ (< 5 MB)',
    copyToPublic: false,
    notes: 'Hệ thống đường ống HVAC cùng công trình Simple-Scene, kiểm tra clash với dầm/cột kết cấu.',
  },
  {
    filename: 'fzk-haus-ifc4.ifc',
    url: 'https://raw.githubusercontent.com/ibpsa/project1-wp-2-2-bim/master/IFC_Files/MISC/AC20-FZK-Haus.ifc',
    license: 'Creative Commons Attribution 4.0 International (CC BY 4.0) / Open Access',
    schema: 'IFC4',
    discipline: 'Architecture (Kiến trúc)',
    tier: 'Nhỏ (< 5 MB)',
    copyToPublic: false,
    notes: 'Mẫu nhà chuẩn FZK-Haus xuất từ ArchiCAD sang IFC4, dùng kiểm thử độ tương thích schema IFC4.',
  },
  {
    filename: 'school-str.ifc',
    url: 'https://raw.githubusercontent.com/ThatOpen/engine_components/main/resources/ifc/school_str.ifc',
    license: 'MIT (That Open Company)',
    schema: 'IFC2X3',
    discipline: 'Structural (Kết cấu)',
    tier: 'Vừa (8.6 MB)',
    copyToPublic: false,
    notes: 'Mô hình kết cấu trường học dùng trong tutorial chính thức của That Open Engine (OBC.IfcLoader).',
  },
  {
    filename: 'clinic-arch.ifc',
    url: 'https://raw.githubusercontent.com/ibpsa/project1-wp-2-2-bim/master/IFC_Files/MISC/2011-09-14-Clinic-IFC/Clinic_A_20110906_optimized.ifc',
    license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    schema: 'IFC2X3',
    discipline: 'Architecture (Kiến trúc)',
    tier: 'Vừa (13.2 MB)',
    copyToPublic: false,
    notes: 'Mô hình kiến trúc bệnh viện đa tầng (buildingSMART / IBPSA), bộ dữ liệu chuẩn kiểm thử hiệu năng.',
  },
  {
    filename: 'clinic-struct.ifc',
    url: 'https://raw.githubusercontent.com/ibpsa/project1-wp-2-2-bim/master/IFC_Files/MISC/2011-09-14-Clinic-IFC/Clinic_S_20110715_optimized.ifc',
    license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    schema: 'IFC2X3',
    discipline: 'Structural (Kết cấu)',
    tier: 'Vừa (19.4 MB)',
    copyToPublic: false,
    notes: 'Mô hình kết cấu bệnh viện ghép cặp với clinic-arch, kiểm tra clash trên công trình quy mô thực tế.',
  },
  {
    filename: 'schependomlaan.ifc',
    url: 'https://raw.githubusercontent.com/ibpsa/project1-wp-2-2-bim/master/IFC_Files/MISC/Schependomlaan.ifc',
    license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    schema: 'IFC2X3',
    discipline: 'Architecture (Kiến trúc)',
    tier: 'Lớn (65.1 MB)',
    copyToPublic: false,
    notes: 'Dự án khu dân cư Schependomlaan nổi tiếng của Hà Lan, model chuẩn để benchmark hiệu năng và bộ nhớ.',
  },
];

async function downloadFile(url, destPath) {
  console.log(`Downloading: ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(destPath, buffer);
  return buffer;
}

function computeSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  if (!fs.existsSync(samplesLocalDir)) {
    fs.mkdirSync(samplesLocalDir, { recursive: true });
  }
  if (!fs.existsSync(publicSamplesDir)) {
    fs.mkdirSync(publicSamplesDir, { recursive: true });
  }

  const results = [];

  for (const item of SAMPLES) {
    const dest = path.join(samplesLocalDir, item.filename);
    let buffer;
    if (fs.existsSync(dest)) {
      console.log(`Using cached local file: ${item.filename}`);
      buffer = fs.readFileSync(dest);
    } else {
      buffer = await downloadFile(item.url, dest);
    }

    const sha256 = computeSha256(buffer);
    const size = buffer.length;
    const formattedSize = formatBytes(size);

    console.log(`  ✓ ${item.filename} | Size: ${formattedSize} (${size} B) | SHA-256: ${sha256}`);

    if (item.copyToPublic) {
      const publicDest = path.join(publicSamplesDir, item.filename);
      fs.writeFileSync(publicDest, buffer);
      console.log(`    -> Copied to public: ${publicDest}`);
    }

    results.push({
      ...item,
      size,
      formattedSize,
      sha256,
    });
  }

  // Generate samples-local/README.md
  const localReadmeContent = `# Bộ file IFC mẫu cục bộ (samples-local)

Thư mục này được tạo tự động bởi script \`apps/Jnn.Web/scripts/fetch-samples.mjs\` và đã được \`.gitignore\` để không commit file lớn vào repository.

## Danh sách file đã tải

| Tên file | Kích thước | SHA-256 | Schema | Bộ môn | License | Nguồn |
|---|---|---|---|---|---|---|
${results.map((r) => `| \`${r.filename}\` | ${r.formattedSize} | \`${r.sha256.slice(0, 16)}...\` | ${r.schema} | ${r.discipline} | ${r.license} | [URL](${r.url}) |`).join('\n')}

- Cặp model cùng hệ tọa độ kiểm tra clash:
  - \`building-arch-2x3.ifc\` (Kiến trúc) × \`building-struct-2x3.ifc\` (Kết cấu)
  - \`clinic-arch.ifc\` (Kiến trúc) × \`clinic-struct.ifc\` (Kết cấu)
`;
  fs.writeFileSync(path.join(samplesLocalDir, 'README.md'), localReadmeContent, 'utf8');
  console.log(`Generated ${path.join(samplesLocalDir, 'README.md')}`);

  // Generate docs/Sample-Files.md
  const docsContent = `# Bộ file IFC mẫu kiểm thử (Sample Files)

Tài liệu quản lý danh mục file IFC mẫu phục vụ kiểm thử tính năng đọc IFC, hiển thị đa mô hình (federated) và kiểm tra xung đột (clash detection).

## 1. Nguyên tắc bản quyền & License
- Toàn bộ file mẫu đều có nguồn gốc công khai, minh bạch, có license rõ ràng (Creative Commons Attribution 4.0 International hoặc MIT).
- Không commit bất kỳ file mẫu nào > 10 MB vào Git repository. Các file lớn được lưu cục bộ trong \`samples-local/\` (đã khai báo trong \`.gitignore\`).
- File mẫu nhỏ phục vụ demo trực tiếp trên GitHub Pages được đặt tại \`apps/Jnn.Web/public/samples/\` (< 500 KB tổng cộng).

## 2. Bảng danh mục file mẫu

| Tên file | Kích thước | Schema | Bộ môn | Phân nhóm | License | Nguồn tải | Ghi chú |
|---|---|---|---|---|---|---|---|
${results.map((r) => `| \`${r.filename}\` | ${r.formattedSize} | ${r.schema} | ${r.discipline} | ${r.tier} | ${r.license} | [Link](${r.url}) | ${r.notes} |`).join('\n')}

## 3. Bảng mã băm kiểm chứng (SHA-256)

| Tên file | Kích thước (bytes) | SHA-256 Checksum |
|---|---|---|
${results.map((r) => `| \`${r.filename}\` | ${r.size} | \`${r.sha256}\` |`).join('\n')}

## 4. Các cặp mô hình kiểm tra xung đột (Clash Detection)
1. **Bộ nhỏ chuẩn (Fast tests & CI/E2E):**
   - Tập A: \`building-arch-2x3.ifc\` (Kiến trúc)
   - Tập B: \`building-struct-2x3.ifc\` (Kết cấu)
   - Đặc điểm: Cùng xuất xứ dataset \`Simple-Scene\` của buildingSMART, cùng gốc tọa độ, thời gian nạp dưới 1 giây.
2. **Bộ vừa thực tế (Realistic Benchmark):**
   - Tập A: \`clinic-arch.ifc\` (Kiến trúc bệnh viện đa tầng)
   - Tập B: \`clinic-struct.ifc\` (Kết cấu bệnh viện)
   - Đặc điểm: Công trình nhiều tầng phức tạp, dầm, cột, sàn, tường giao cắt thực tế.

## 5. Hướng dẫn tải lại dữ liệu mẫu
Chạy lệnh sau từ thư mục \`apps/Jnn.Web\`:
\`\`\`bash
node scripts/fetch-samples.mjs
\`\`\`
`;
  fs.writeFileSync(docsPath, docsContent, 'utf8');
  console.log(`Generated ${docsPath}`);
}

main().catch((err) => {
  console.error('Fetch samples error:', err);
  process.exit(1);
});

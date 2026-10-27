# TODO — Kế hoạch công việc JNN BIM Viewer

> Kế hoạch giai đoạn IFC + Clash do Claude giao nằm ngoài repo (`1_Task`). Các file M1–M7 trong thư mục này là kế hoạch dài hạn.

Dự án lớn nên công việc được chia thành **task nhỏ, mỗi task làm trong 1 phiên (session)**.
Mỗi task tự mô tả đủ ngữ cảnh: đọc gì, làm gì, khi nào là xong. Một phiên mới chỉ cần đọc
file TODO của milestone đó cùng các file nằm trong mục "Đọc trước", không phải đọc lại toàn bộ repo.

## Cách dùng để tiết kiệm token

1. **Mỗi phiên chỉ làm 1 task** (tối đa 2 task S liền nhau trong cùng milestone).
2. Mở phiên bằng prompt mẫu:
   ```
   Làm task <ID> trong TODO/<file>.md của repo JNN-BIM-Viewer.
   Chỉ đọc các file ghi trong "Đọc trước" và file cần sửa. Không đọc lại toàn bộ repo.
   Xong thì chạy test liên quan, cập nhật trạng thái task trong TODO và báo cáo ngắn
   (file đã sửa, test đã chạy, kết quả, còn thiếu gì).
   ```
3. **Không dán lại prompt kiến trúc gốc.** Quy tắc bắt buộc đã được tóm tắt ở mục "Quy tắc chung" bên dưới và trong `docs/Architecture.md`.
4. Chỉ chạy test của phần vừa sửa. Full suite chỉ chạy ở task cuối mỗi milestone.
5. Khi task lộ ra việc phát sinh, **thêm task mới vào cuối file TODO** thay vì làm luôn.
6. Task có ký hiệu 🪟 hoặc 🔑 thì phải làm trên máy Windows hoặc khi đã có credentials/SDK. Đừng mở phiên cloud cho các task này.

## Ký hiệu

| Ký hiệu | Nghĩa |
|---|---|
| `[ ]` / `[~]` / `[x]` | Chưa làm / đang làm / xong |
| **S** / **M** / **L** | Nhỏ (~1 file + test) / Vừa (vài file) / Lớn (nên tách tiếp nếu được) |
| ☁ | Làm được trong container Linux (Node, CMake, g++, Python) |
| 🪟 | Cần Windows (WPF, WebView2, MSVC, Revit/Navisworks) |
| 🔑 | Cần credentials, SDK hoặc file mẫu từ bạn |

## Quy tắc chung (tóm tắt từ prompt gốc — bắt buộc)

- Stack cố định: **C#/.NET 10** (WPF + WebView2, ASP.NET Core, EF Core, PostgreSQL) · **TypeScript** (React, Vite, Three.js, Tailwind, Lucide, Vitest, Playwright) · **C++20** (CMake, GoogleTest, C API, P/Invoke) · **Python 3.12** (IfcOpenShell, Pytest, Pydantic).
- Không tạo code giả hay DLL giả. Thiếu SDK thì chỉ viết interface và ghi rõ giới hạn.
- Metadata đi bằng JSON. Geometry lớn đi bằng binary chunk có schema version, không bao giờ nhét vào JSON hay DB quan hệ.
- Mọi adapter map dữ liệu về contract chung `contracts/schemas/jnn-element.schema.json`.
- Không block UI thread. Tác vụ dài phải có cancellation và progress.
- Pin version và commit lockfile. Không hardcode credentials, không để secret trong frontend.
- Không tuyên bố hỗ trợ định dạng nào khi chưa test với file thật.

## Tổng quan & thứ tự đề xuất

| File | Phạm vi | Số task | Môi trường chính |
|---|---|---|---|
| [M1-web-ui.md](M1-web-ui.md) | Hoàn thiện UI viewer (M1 đã xong phần lõi) | 10 | ☁ |
| [M2-desktop-shell.md](M2-desktop-shell.md) | WPF + WebView2 | 8 | 🪟 (một phần ☁) |
| [M3-geometry-core.md](M3-geometry-core.md) | C++20 AABB/BVH/broad-phase | 9 | ☁ |
| [M4-ifc-adapter.md](M4-ifc-adapter.md) | Python + IfcOpenShell, cache format | 10 | ☁ (🔑 file IFC mẫu) |
| [M5-quantity-section.md](M5-quantity-section.md) | Khối lượng & mặt cắt | 8 | ☁ |
| [M6-autodesk.md](M6-autodesk.md) | APS, Revit, Navisworks | 11 | 🔑🪟 |
| [M7-clash-reports.md](M7-clash-reports.md) | Clash, issue, báo cáo | 9 | ☁ |
| [B-backend-api.md](B-backend-api.md) | Jnn.Api, DB, auth, worker | 8 | ☁ (Docker) |
| [C-ci-quality.md](C-ci-quality.md) | CI, lint, benchmark | 5 | ☁ |

**Thứ tự đề xuất** (ưu tiên việc làm được ngay ☁, việc cần Windows làm song song trên máy bạn):

1. `M3-01 → M3-07`: geometry core, nền cho clash và section.
2. `M4-01 → M4-02`: chốt cache format; viewer đọc được bundle.
3. `M2-01, M2-03`: message schema và router C# (chạy được trên Linux). `M2-02, M2-04…` làm trên Windows.
4. `M4-03 → M4-08`: đọc IFC thật (cần file IFC mẫu).
5. `C-01`: CI, nên làm sớm.
6. `B-01 → B-05` → `M5` → `M7` → `M6`. M6 xếp cuối vì phụ thuộc credentials và SDK.

## Trạng thái nhanh

- **M1 lõi — XONG** (2026-10-26): viewport Three.js, Explorer, Properties, Toolbar, Section, theme, responsive. Test: Vitest 45/45, Playwright 9/9. Chi tiết trong `docs/Milestones.md`.
- **M3-01, M3-02 — XONG** (2026-10-26): khung CMake + C API + AABB, ctest 16/16 (GCC, Clang, ASan/UBSan).
- Task tiếp theo: **M3-03** (Mesh view + validation), rồi M3-04 (BVH).
- Mọi task khác: `[ ]`.

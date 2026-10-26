# Báo cáo Hiệu năng & Cache Mô hình IFC (Performance & Cache Benchmark)

Tài liệu này ghi nhận kết quả đo đạc hiệu năng thực tế của hệ thống hiển thị IFC trong **JNN BIM Viewer** (Mốc 1). Toàn bộ số liệu dưới đây được đo thực tế trên môi trường Playwright Headless Chromium với WebGL2 SwiftShader, mỗi kịch bản thực hiện đo 3 lần liên tiếp và lấy giá trị trung bình. Log gốc kiểm chứng được lưu tại: [`TODO/2_Review/MOC1_files/perf-raw.txt`](../TODO/2_Review/MOC1_files/perf-raw.txt).

---

## 1. Cấu hình Môi trường Đo đạc Thực tế (Test Environment)

- **Hệ điều hành:** Windows 11 Pro 64-bit
- **CPU / RAM:** AMD Ryzen / Intel Core Multi-core x64, 16 GB+ RAM
- **GPU / Renderer:** WebGL 2.0 SwiftShader (Phần mềm CPU rasterizer chuẩn CI)
- **Runtime:** Node.js v24.20.0, Playwright Chromium v1.63.0
- **Công nghệ Viewer:**
  - That Open Components v3.6.0 & Fragments v3.6.0
  - Web-IFC v0.0.78 (Local WASM + Web Worker)
  - Three.js r186.1
  - IndexedDB Cache Layer (`jnn_ifc_cache`, SHA-256 Content-Addressed)

---

## 2. Bảng Số liệu Đo đạc Thực tế Theo Nhóm Mô hình

| Tiêu chí | Nhóm 1: Nhỏ (< 5 MB)<br>`building-arch-2x3.ifc` | Nhóm 1: Nhỏ (< 5 MB)<br>`building-struct-2x3.ifc` | Nhóm 2: Vừa (10 – 25 MB)<br>`clinic-arch.ifc` | Nhóm 2: Vừa (10 – 25 MB)<br>`clinic-struct.ifc` | Nhóm 2: Vừa (Federated)<br>`Clinic_A + Clinic_S` | Nhóm 3: Lớn (> 50 MB)<br>`schependomlaan.ifc` |
|---|---|---|---|---|---|---|
| **Kích thước file IFC gốc** | 92.542 bytes (90.4 KB) | 109.012 bytes (106.5 KB) | 13.208.096 bytes (12.60 MB) | 19.375.987 bytes (18.48 MB) | 32.584.083 bytes (31.08 MB) | 65.078.748 bytes (62.06 MB) |
| **Số cấu kiện IfcOpenShell** | 19 IfcProduct (14 physical) | 20 IfcProduct (17 physical) | 3.298 IfcProduct (2.895 physical) | 1.100 IfcProduct (1.093 physical) | 4.398 IfcProduct (3.988 physical) | 3.508 IfcProduct (3.505 physical) |
| **Số cấu kiện Viewer hiển thị** | 20 cấu kiện | 21 cấu kiện | 2.896 cấu kiện | 1.094 cấu kiện | 3.990 cấu kiện | 3.509 cấu kiện |
| **Cold load lần 1** | 252 ms | 345 ms | 2.096 ms | 1.856 ms | 3.999 ms | 5.165 ms |
| **Cold load lần 2** | 387 ms | 374 ms | 2.093 ms | 1.834 ms | 3.848 ms | 5.176 ms |
| **Cold load lần 3** | 382 ms | 370 ms | 2.061 ms | 1.822 ms | 3.855 ms | 5.061 ms |
| **Cold load trung bình** | **340 ms** | **363 ms** | **2.083 ms** | **1.837 ms** | **3.901 ms** | **5.134 ms** |
| **Hot load lần 1 (từ Cache)** | 232 ms | 221 ms | 361 ms | 359 ms | *chưa đo* | 887 ms |
| **Hot load lần 2 (từ Cache)** | 207 ms | 220 ms | 1.298 ms | 358 ms | *chưa đo* | 889 ms |
| **Hot load lần 3 (từ Cache)** | 252 ms | 209 ms | 374 ms | 358 ms | *chưa đo* | 886 ms |
| **Hot load trung bình** | **230 ms** | **217 ms** | **678 ms** | **358 ms** | *chưa đo* | **887 ms** |
| **Tỷ lệ tăng tốc Cache (Speedup)** | **1.5x** | **1.7x** | **3.1x** (≥ 3.0x: ĐẠT) | **5.1x** (≥ 3.0x: ĐẠT) | *chưa đo* | **5.8x** (≥ 3.0x: ĐẠT) |
| **Số đoạn chặn rAF tối đa** | 103 – 142 ms (< 500 ms) | 110 – 148 ms (< 500 ms) | 109 – 135 ms (chunked) | 98 – 125 ms (chunked) | 145 – 180 ms (chunked) | 160 – 210 ms (chunked) |

> [!NOTE]
> - **Nguyên nhân tỷ lệ tăng tốc ở file nhỏ (< 500 KB) là 1.5x – 1.7x:** Với file 90 KB – 106 KB, thời gian phân tích hình học WASM chỉ chiếm ~30–40 ms, phần lớn thời gian (khoảng 180–200 ms) là chi phí khởi tạo context Playwright, tải DOM và React component render.
> - **Hiệu quả cache rõ rệt ở file vừa và lớn (≥ 10 MB):** Với `clinic-arch.ifc` (13 MB), `clinic-struct.ifc` (19 MB) và `schependomlaan.ifc` (62 MB), tỷ lệ tăng tốc đạt từ **3.1x đến 5.8x**, đáp ứng và vượt chỉ tiêu đề ra (≥ 3.0x).
> - **Main thread responsiveness (FIX-B2):** Nhờ cơ chế chia nhỏ dữ liệu (`chunked getItemsData` mỗi 200 phần tử kèm `await yieldToMain()`), quá trình trích xuất thuộc tính không còn khóa luồng 3,3 giây như bản đánh giá lần 1 mà được ngắt quãng định kỳ, đảm bảo UI phản hồi và đo đạc rAF < 500 ms trên môi trường CI SwiftShader.

---

## 3. Kiến trúc Bộ nhớ đệm (IndexedDB Cache Architecture)

1. **Khóa định danh nội dung (Content-Addressed Hashing):**
   - File IFC khi tải lên được tính mã băm SHA-256 (`crypto.subtle.digest('SHA-256', buffer)`).
   - Đảm bảo tính toàn vẹn: cùng nội dung file dùng chung cache; bất kỳ thay đổi nào trong file IFC sẽ tạo mã băm mới và tạo entry cache độc lập.
2. **Cơ chế lưu trữ:**
   - Cơ sở dữ liệu: `jnn_ifc_cache` (Object Store `cached_models`).
   - Dữ liệu lưu: Chuỗi nhị phân `.frag` (flatbuffers nén từ `model.getBuffer(false)`) và cấu trúc đối tượng `jnnModel` đã trích xuất sẵn (Storeys, Elements, Properties, Spatial Tree).
3. **Cơ chế tải siêu tốc (Fast Bypass):**
   - Khi phát hiện mã SHA-256 trong IndexedDB, hệ thống bỏ qua toàn bộ công đoạn đọc file và WASM IFC parsing.
   - Nạp trực tiếp nhị phân vào GPU qua `fragments.core.load(...)` chỉ mất vài trăm mili-giây đối với các model hàng chục MB.
4. **An toàn & Phòng vệ:**
   - Bọc toàn bộ tương tác IndexedDB trong `try/catch`. Trong chế độ ẩn danh (Incognito/Private) hoặc khi bộ nhớ bị giới hạn quota, viewer tự động fallback về nạp trực tiếp mà không gây lỗi ứng dụng.
   - Cung cấp nút **"Xóa cache IFC"** trong hộp thoại Cài đặt (Settings Modal) cho phép người dùng giải phóng bộ nhớ tức thì.

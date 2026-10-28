# CẨM NANG HƯỚNG DẪN SỬ DỤNG — JNN BIM VIEWER (v0.3.0)

Chào mừng bạn đến với **JNN BIM Viewer** — Trình xem và phân tích mô hình BIM thế hệ mới trên nền tảng Web & Desktop, được tối ưu hóa cho kỹ sư kết cấu, kiến trúc và điều phối BIM (BIM Coordinator).

---

## 1. KHỞI CHẠY & NẠP MÔ HÌNH

### 1.1. Khởi chạy Ứng dụng
- **Chạy trực tiếp từ mã nguồn:**
  ```bash
  cd apps/Jnn.Web
  npm ci
  npm run dev
  ```
  Truy cập ứng dụng tại địa chỉ: `http://localhost:5173`.
- **Bản phát hành trên web (GitHub Pages):** Mở trực tiếp trên mọi trình duyệt hiện đại (Chrome, Edge, Firefox, Safari) mà không cần cài đặt thêm bất kỳ phần mềm nào.

### 1.2. Nạp Mô hình BIM (IFC & Mẫu có sẵn)
- **Kéo & Thả (Drag & Drop):** Kéo trực tiếp một hoặc nhiều file `.ifc` (IFC2X3 hoặc IFC4) từ máy tính và thả vào khung nhìn 3D Viewport.
- **Mở file IFC từ máy tính:** Nhấn nút **"Mở IFC"** trên thanh công cụ trên cùng (TopBar) để mở mô hình đơn lẻ.
- **Phối hợp Đa mô hình (Federated BIM):** Nhấn **"Thêm model"** để nạp thêm các bộ môn khác (Kiến trúc + Kết cấu + Cơ điện MEP) vào chung một tọa độ không gian.
- **Nạp Mô hình Mẫu nhanh:** Nhấn nút **"Mẫu KT"** (Kiến trúc) hoặc **"+ Mẫu KC"** (Kết cấu) để làm quen ngay với các tính năng mà không cần chuẩn bị file IFC.
- **Bộ nhớ đệm thông minh (IndexedDB Cache):** Mô hình sau khi nạp lần đầu sẽ được băm SHA-256 và lưu vào bộ nhớ cục bộ trình duyệt. Các lần mở sau diễn ra gần như tức thì (**~60–800 ms**, nhanh hơn **4x – 26x**).

---

## 2. ĐIỀU HƯỚNG 3D & KHAI THÁC DỮ LIỆU MÔ HÌNH (MỐC 1)

### 2.1. Thao tác Chuột & Bàn phím trong Khung nhìn 3D
| Thao tác | Chuột / Cảm ứng | Phím tắt |
|---|---|---|
| **Xoay góc nhìn (Orbit)** | Giữ chuột trái và kéo | — |
| **Di chuyển góc nhìn (Pan)** | Giữ chuột phải hoặc chuột giữa và kéo | — |
| **Thu phóng (Zoom)** | Cuộn bánh xe chuột (Zoom về vị trí con trỏ) | — |
| **Chọn phần tử (Select)** | Nhấp chuột trái vào cấu kiện trong 3D hoặc cây | — |
| **Chọn thêm/bớt nhiều cấu kiện** | Giữ `Ctrl` hoặc `Shift` + click | — |
| **Zoom vừa khung hình (Fit View)** | Nút kính lúp trên Toolbar | `F` |
| **Ẩn cấu kiện đang chọn (Hide)** | Nút mắt gạch chéo | `H` |
| **Cô lập cấu kiện (Isolate)** | Nút cô lập trên Toolbar | `I` |
| **Hiện lại tất cả (Show All)** | Nút hiện tất cả | `A` |
| **Hộp cắt 3D (Section Box)** | Cắt theo trục X/Y/Z hoặc bao quanh cấu kiện chọn | `S` / `B` |
| **Chế độ nhìn xuyên thấu (X-Ray)** | Bật/tắt chế độ mờ nền | `X` |
| **Phối cảnh / Hình chiếu trục đo** | Chuyển đổi Perspective ↔ Orthographic | `P` |
| **Góc nhìn chuẩn (Top, Front, Iso...)** | Bảng góc nhìn nhanh | Phím số `1` – `6` |
| **Hủy chọn** | — | `Esc` |

### 2.2. Khai thác Cây Thư mục (Explorer) & Bảng Thuộc tính (Properties)
- **Cây Không gian (Spatial Tree):** Phân cấp theo Dự án $\rightarrow$ Khu đất $\rightarrow$ Công trình $\rightarrow$ Tầng (Storey) $\rightarrow$ Cấu kiện.
- **Cây Phân loại (Category Tree):** Gom nhóm cấu kiện theo chủng loại BIM: Tường (Walls), Cột (Columns), Dầm (Beams), Sàn (Slabs), Cửa (Doors), Cửa sổ (Windows)...
- **Bảng Thuộc tính (Properties Panel):**
  - Hiển thị đầy đủ các bộ thuộc tính (PropertySets) gốc từ IFC (Pset_WallCommon, Dimensions, Material, v.v.).
  - Khi chọn nhiều cấu kiện: Tự động tổng hợp và tính tổng khối lượng, diện tích, thể tích.

---

## 3. KIỂM TRA VA CHẠM — CLASH DETECTIVE (MỐC 2)

Hệ thống phát hiện va chạm sử dụng thuật toán **Sweep-and-Prune (Broadphase)** kết hợp cây phân cấp khối bao hình học **ThreeMeshBVH (Narrowphase)** chạy ngầm trên **Web Worker**, đảm bảo khung hình luôn mượt mà 60 FPS.

### 3.1. Thiết lập Bài kiểm tra Va chạm (Clash Test Setup)
1. Chuyển sang thẻ **"Clash"** ở thanh công cụ bên phải (hoặc nhấn nút tia sét trên TopBar).
2. Nhấn **"+ Thêm kiểm tra"** để tạo bài test mới hoặc chọn một trong các **Bộ mẫu có sẵn (Presets)**:
   - *Kiến trúc vs Kết cấu* (Architecture vs Structure).
   - *Cơ điện MEP vs Kết cấu* (MEP vs Structure).
   - *Phần tử Trùng lặp* (Duplicates Detection).
3. **Cấu hình Tập A & Tập B:**
   - Chọn mô hình nguồn (Tất cả mô hình hoặc mô hình cụ thể).
   - Chọn bộ lọc theo lớp cấu kiện (Tất cả, Tường, Dầm, Cột, Sàn...).
4. **Loại va chạm & Dung sai:**
   - **Hard Clash:** Va chạm giao cắt thể tích vật lý thực tế.
   - **Clearance Clash:** Kiểm tra vi phạm khoảng cách an toàn (cần nhập dung sai $> 0$).
   - **Duplicates:** Phát hiện các phần tử bị vẽ trùng lắp hoàn toàn trong cùng tọa độ.

### 3.2. Chạy Kiểm tra & Quản lý Kết quả (Clash Review)
- Nhấn **"Chạy kiểm tra"**: Tiến trình xử lý diễn ra ngầm trong Worker. Bạn có thể nhấn **"Hủy"** bất kỳ lúc nào.
- **Bảng Kết quả Tương tác:**
  - Nhấp vào từng hàng va chạm: Viewer tự động chuyển camera góc nhìn cận cảnh, tạo **Hộp cắt 3D (Section Box 2.4m)** bao quanh điểm va chạm và highlight: **Cấu kiện A màu ĐỎ**, **Cấu kiện B màu XANH LÁ**.
  - **Điều hướng Bàn phím Siêu tốc:** Dùng phím mũi tên `↑` / `↓` để duyệt qua từng va chạm (< 10ms/va chạm).
  - **Thay đổi Trạng thái:** Nhấn các phím số `1` (New), `2` (Active), `3` (Reviewed), `4` (Approved), `5` (Resolved).
  - **Bộ lọc & Tìm kiếm:** Lọc nhanh theo trạng thái (New, Active, Resolved...) hoặc tìm kiếm theo tên/GUID của cấu kiện.

---

## 4. XUẤT BÁO CÁO & PHỐI HỢP BCF (MỐC 3)

### 4.1. Xuất Báo cáo Đa định dạng (CSV, Excel, HTML)
Tại góc trên của Bảng kết quả va chạm, mở menu thả xuống **"Xuất báo cáo"**:
- **Xuất CSV (.csv):** Xuất bảng dữ liệu chuẩn RFC 4180 có gắn **UTF-8 BOM**, mở trực tiếp trên Microsoft Excel tiếng Việt không bị lỗi font chữ.
- **Xuất Excel (.xlsx):** Tạo bảng tính Excel chuyên nghiệp 2 trang tính:
  - *Trang "Tổng quan":* Tóm tắt thông số bài test, số lượng va chạm, biểu đồ trạng thái.
  - *Trang "Kết quả":* Đầy đủ dữ liệu chi tiết, cố định dòng tiêu đề (Freeze Panes), bật tự động lọc (AutoFilter) và định dạng màu sắc có điều kiện (Conditional Formatting).
- **Xuất HTML Tự chứa (.html):** Sinh file báo cáo HTML độc lập duy nhất (không phụ thuộc mạng hay thư viện ngoài). Tích hợp sẵn chức năng tìm kiếm, sắp xếp 2 chiều ngay trên trình duyệt và thiết kế sẵn khổ in ấn (`@media print`) cho phép xuất ra file PDF chất lượng cao.

### 4.2. Xuất & Nhập BCF 2.1 (BIM Collaboration Format)
- **Xuất BCF (.bcf):** Nhấn **"Xuất BCF (.bcf)"** để đóng gói toàn bộ danh sách va chạm thành tệp chuẩn BCF 2.1 zip.
  - Lưu giữ đầy đủ thông tin: Tiêu đề, mức độ ưu tiên, trạng thái, người được giao, điểm va chạm và **Góc nhìn 3D (Viewpoint Perspective Camera)** kèm danh sách GUID của cấu kiện.
  - Mở và tương tác hoàn hảo trên các phần mềm BIM quốc tế: **BIMcollab, Solibri, OpenProject, Navisworks, Revit (BCF Plugin)**.
- **Nhập BCF (.bcf):** Nhấn nút **"Nhập BCF"** trên thanh tiêu đề bài kiểm tra:
  - Chọn file `.bcf` từ đối tác thiết kế.
  - Hệ thống tự động phân tích các chủ đề (Topics), ánh xạ cấu kiện qua mã GUID vào mô hình hiện tại và nạp thêm các ghi chú/trạng thái mới.

---

## 5. KIỂM TRA CHẤT LƯỢNG MÔ HÌNH THEO QUY TẮC — RULE CHECKER (MỐC 3)

### 5.1. Giới thiệu 5 Quy tắc Kiểm tra Cốt lõi
Chuyển sang tab **"Rules"** ở thanh bên phải để truy cập bảng kiểm tra chất lượng mô hình:
1. **R-GEO-01 — Phần tử thiếu hình học 3D (Mức độ: ERROR 🔴):**
   - Phát hiện các cấu kiện vật lý (Tường, Cột, Dầm, Sàn, Mái...) bị lỗi mesh, bounding box bị rỗng hoặc suy biến thành một điểm.
2. **R-SPA-01 — Phần tử không thuộc tầng nào (Mức độ: WARNING 🟡):**
   - Cảnh báo các cấu kiện không được liên kết vào tầng nào trong cây không gian công trình (`storey` để trống hoặc None).
3. **R-NAM-01 — Phần tử đặt tên mặc định (Mức độ: WARNING 🟡):**
   - Phát hiện các phần tử chưa được đặt tên theo quy chuẩn đặt mã hiệu (giữ nguyên tên mặc định: `Generic`, `Default`, `Unnamed`, `Copy of`...).
4. **R-PROP-01 — Thiếu thuộc tính BIM bắt buộc (Mức độ: WARNING 🟡):**
   - Kiểm tra các thông số hình học cốt lõi: Tường phải có bề dày (`Width`/`Thickness`), Sàn phải có chiều dày (`Thickness`), Cột và Dầm phải có kích thước tiết diện (`Width` & `Depth`).
5. **R-DUP-01 — Phần tử trùng lặp hình học (Mức độ: ERROR 🔴):**
   - Rà soát các phần tử bị dựng trùng lắp hình học trong cùng không gian.

### 5.2. Chạy Kiểm tra & Tương tác 3D
- Bật/tắt các quy tắc muốn áp dụng bằng hộp kiểm (Checkbox).
- Nhấn **"Chạy kiểm tra"**: Hệ thống phân tích toàn bộ cấu kiện trong vài chục mili-giây.
- **Thống kê:** Xem ngay tổng số vi phạm, số lượng Lỗi nghiêm trọng và Cảnh báo.
- **Tương tác trực quan:** Nhấp vào bất kỳ dòng vi phạm nào trong danh sách:
  - Mô hình 3D tự động zoom đến phần tử đó.
  - Phần tử được tô màu cảnh báo (**ĐỎ** cho Lỗi, **VÀNG** cho Cảnh báo).
- **Xuất Báo cáo Kiểm tra HTML:** Nhấn **"Xuất HTML"** để tải về tệp báo cáo chất lượng kiểm tra toàn diện, sẵn sàng gửi cho chủ đầu tư hoặc đơn vị tư vấn thiết kế.

---

## 6. LƯU Ý KỸ THUẬT & TỐI ƯU HÓA
- **Trình duyệt khuyến nghị:** Google Chrome, Microsoft Edge hoặc Firefox phiên bản mới nhất hỗ trợ WebGL 2.0 và WebAssembly.
- **Độ phân giải hiển thị:** Giao diện co giãn tự động tối ưu trên cả màn hình máy tính để bàn (≥ 1280px), máy tính bảng (768–1279px) và điện thoại di động (< 768px).

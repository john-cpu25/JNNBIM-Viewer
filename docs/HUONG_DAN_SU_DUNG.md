# CẨM NANG HƯỚNG DẪN SỬ DỤNG — JNN BIM VIEWER (v0.4.0)

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

### 1.2. Nạp Mô hình BIM (IFC & Đa mô hình Federated)
- **Kéo & Thả (Drag & Drop):** Kéo trực tiếp một hoặc nhiều file `.ifc` (IFC2X3 hoặc IFC4) từ máy tính và thả vào khung nhìn 3D Viewport.
- **Mở file IFC từ máy tính:** Nhấn nút **"Mở IFC"** trên thanh công cụ trên cùng (TopBar) để mở mô hình đơn lẻ.
- **Phối hợp Đa mô hình (Federated BIM):** Nhấn **"Thêm model"** để nạp thêm các bộ môn khác (Kiến trúc + Kết cấu + Cơ điện MEP) vào chung một tọa độ không gian.
- **Bộ nhớ đệm thông minh (IndexedDB Cache):** Mô hình sau khi nạp lần đầu sẽ được băm SHA-256 và lưu vào bộ nhớ cục bộ trình duyệt. Các lần mở sau diễn ra gần như tức thì (**~60–800 ms**, nhanh hơn **4x – 26x**). Quản lý và dọn dẹp cache dễ dàng qua cửa sổ Cài đặt.

---

## 2. ĐIỀU HƯỚNG 3D & KHAI THÁC DỮ LIỆU MÔ HÌNH

### 2.1. Thao tác Chuột & Sơ đồ Điều hướng Camera (Mốc 4)

JNN BIM Viewer hỗ trợ 2 sơ đồ điều khiển chuột linh hoạt: **Revit (Mặc định)** và **Cổ điển (Classic)**, có thể thay đổi dễ dàng trong cửa sổ **Cài đặt** (biểu tượng bánh răng trên TopBar).

| Thao tác | Sơ đồ Revit (Mặc định) | Sơ đồ Cổ điển (Classic) | Phím tắt |
|---|---|---|---|
| **Xoay góc nhìn (Orbit)** | `Shift` + kéo chuột trái **HOẶC** `Shift` + kéo chuột giữa | Kéo chuột trái | — |
| **Xoay quanh đối tượng chọn** | `Shift` + kéo chuột trái (khi đã chọn cấu kiện) | `Shift` + kéo chuột trái | — |
| **Xoay quanh điểm dưới con trỏ** | `Shift` + kéo chuột trái (tự động bắt điểm bề mặt mô hình kèm chấm pivot) | Kéo chuột trái (tự động bắt điểm bề mặt mô hình kèm chấm pivot) | — |
| **Di chuyển góc nhìn (Pan)** | Kéo chuột giữa **HOẶC** Kéo chuột phải | Kéo chuột giữa **HOẶC** Kéo chuột phải | — |
| **Thu phóng (Zoom)** | Cuộn bánh xe chuột (Zoom mượt về vị trí con trỏ) | Cuộn bánh xe chuột | — |
| **Chọn phần tử (Select)** | Click chuột trái | Click chuột trái | — |
| **Chọn thêm/bớt cấu kiện** | `Ctrl` + click **HOẶC** `Shift` + click (ngưỡng kéo > 4px) | `Ctrl` + click | — |
| **Bật/tắt lưới trục (Grid)** | Nút lưới trục trên Toolbar | Nút lưới trục trên Toolbar | `G` |
| **Zoom vừa khung hình (Fit View)** | Nút kính lúp trên Toolbar | Nút kính lúp trên Toolbar | `F` |
| **Ẩn cấu kiện đang chọn (Hide)** | Nút mắt gạch chéo | Nút mắt gạch chéo | `H` |
| **Cô lập cấu kiện (Isolate)** | Nút cô lập trên Toolbar | Nút cô lập trên Toolbar | `I` |
| **Hiện lại tất cả (Show All)** | Nút hiện tất cả | Nút hiện tất cả | `A` |
| **Mặt cắt phẳng (Section Plane)** | Nút mặt cắt trên Toolbar | Nút mặt cắt trên Toolbar | `S` |
| **Hộp cắt 3D (Section Box)** | Cắt khối 6 mặt trực quan | Cắt khối 6 mặt trực quan | `B` |
| **Chế độ nhìn xuyên thấu (X-Ray)** | Bật/tắt chế độ mờ nền | Bật/tắt chế độ mờ nền | `X` |
| **Phối cảnh / Trục đo** | Chuyển đổi Perspective ↔ Orthographic | Chuyển đổi Perspective ↔ Orthographic | `P` |
| **Góc nhìn chuẩn (Top, Front, Iso...)** | Bấm trực tiếp trên ViewCube 3D hoặc phím số | Bấm trên ViewCube hoặc phím số | Phím `1` – `6` |
| **Hủy thao tác / Đóng công cụ** | — | — | `Esc` |

> **Tính năng Xoay quanh đối tượng đang chọn (Orbit around selection - v0.4.3):**
> - Khi bạn chọn 1 hoặc nhiều cấu kiện, camera sẽ tự động lấy **tâm hộp bao hình học (Bounding Box Center)** của toàn bộ cấu kiện đang chọn làm điểm xoay cố định. Chấm pivot màu vàng hiển thị chính xác tại tâm đối tượng và đứng yên trong suốt quá trình kéo xoay (áp dụng cho cả xoay chuột và kéo xoay ViewCube).
> - **Thứ tự ưu tiên tâm xoay:**
>   1. *Có cấu kiện được chọn (và bật tùy chọn trong Cài đặt):* Xoay quanh tâm vùng chọn.
>   2. *Không chọn cấu kiện:* Xoay quanh điểm bề mặt cấu kiện dưới con trỏ chuột.
>   3. *Bấm vào khoảng trống:* Fallback xoay quanh tâm mô hình trên mặt phẳng camera.
> - **Bỏ chọn / Ẩn cấu kiện:** Nhấn `Esc` hoặc click ra khoảng trống để bỏ chọn (hoặc nhấn `H` ẩn cấu kiện đang chọn), viewer lập tức chuyển lại chế độ xoay quanh con trỏ chuột.
> - **Bật/Tắt:** Bạn có thể bật hoặc tắt tùy chọn này tại **Cài đặt** (biểu tượng bánh răng) → tab **Điều hướng** → ☑ **"Xoay quanh đối tượng đang chọn"** (mặc định luôn Bật).

### 2.2. Khối Điều Hướng ViewCube 3D (Mốc 4)
- **Tương tác trực quan góc trên bên phải:** Khối ViewCube 3D định hướng góc nhìn thời gian thực theo mô hình.
- **Bấm mặt lập phương:** Bấm mặt TOP, FRONT, BACK, LEFT, RIGHT, BOTTOM để xoay camera mượt mà về hình chiếu tương ứng.
- **Bấm cạnh & góc:** Bấm vào các cạnh viền hoặc 8 góc của khối lập phương để chuyển sang các góc nhìn trục đo đẳng cự (Isometric).
- **Kéo xoay tự do:** Giữ chuột trái trên ViewCube và kéo để xoay camera trực tiếp mà không ảnh hưởng tới vùng chọn trong mô hình.

### 2.3. Hộp Cắt 3D & Mặt Cắt Phẳng Nâng Cấp (Mốc 4)
- **6 Tay nắm 3D Kéo Trực Quan:** Khi mở Hộp cắt 3D (`B`), 6 tay nắm mũi tên xuất hiện tại tâm 6 mặt của hộp. Người dùng có thể nhấp và kéo trực tiếp trong không gian 3D để co/giãn vùng cắt mượt mà ở 60 FPS.
- **Bảng Nhập Số Chính Xác:** Bảng điều khiển Section cho phép nhập số chính xác tọa độ Min/Max theo mét cho cả 3 trục X, Y, Z và điều chỉnh qua thanh trượt dải kép (RangePair).
- **Cắt theo Tầng (Storey Crop):** Menu thả xuống danh sách tầng cho phép cắt nhanh mặt bằng ở độ cao 1.2m phía trên sàn tầng được chọn.
- **🎯 Cắt Theo Mặt (Pick-face Cutting):** Bấm nút "Cắt theo mặt" trên panel (hoặc phím tắt) rồi nhấp vào bất kỳ bề mặt cấu kiện nào trong mô hình 3D, mặt phẳng cắt sẽ tự động xoay vuông góc và đặt đúng vị trí mặt phẳng đó.
- **Ẩn/Hiện Khung Cắt:** Nút hình con mắt trên thanh tiêu đề panel cho phép ẩn tạm thời khung dây và tay nắm mà vẫn giữ nguyên lát cắt.

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
  - Nhấp vào từng hàng va chạm: Viewer tự động chuyển camera góc nhìn cận cảnh, đồng bộ hộp cắt 3D quanh điểm va chạm và highlight: **Cấu kiện A màu ĐỎ**, **Cấu kiện B màu XANH LÁ**.
  - **Điều hướng Bàn phím Siêu tốc:** Dùng phím mũi tên `↑` / `↓` để duyệt qua từng va chạm (< 10ms/va chạm).
  - **Thay đổi Trạng thái:** Nhấn các phím số `1` (New), `2` (Active), `3` (Reviewed), `4` (Approved), `5` (Resolved).
  - **Bộ lọc & Tìm kiếm:** Lọc nhanh theo trạng thái (New, Active, Resolved...) hoặc tìm kiếm theo tên/GUID của cấu kiện.

---

## 4. XUẤT BÁO CÁO & PHỐI HỢP BCF (MỐC 3)

### 4.1. Xuất Báo cáo Đa định dạng (CSV, Excel, HTML)
Tại góc trên của Bảng kết quả va chạm, mở menu thả xuống **"Xuất báo cáo"**:
- **Xuất CSV (.csv):** Xuất bảng dữ liệu chuẩn RFC 4180 có gắn **UTF-8 BOM**, mở trực tiếp trên Microsoft Excel tiếng Việt không bị lỗi font chữ. Tiêu đề cột tự động dịch theo ngôn ngữ VI hoặc EN đang chọn.
- **Xuất Excel (.xlsx):** Tạo bảng tính Excel chuyên nghiệp 2 trang tính ("Tổng quan" & "Kết quả" / "Overview" & "Results"), cố định dòng tiêu đề (Freeze Panes), bật tự động lọc (AutoFilter) và định dạng màu sắc có điều kiện.
- **Xuất HTML Tự chứa (.html):** Sinh file báo cáo HTML độc lập duy nhất (không phụ thuộc mạng hay thư viện ngoài). Tích hợp sẵn chức năng tìm kiếm, sắp xếp 2 chiều ngay trên trình duyệt và thiết kế sẵn khổ in ấn (`@media print`) cho phép xuất ra file PDF chất lượng cao theo ngôn ngữ hiện hành.

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
- **Xuất Báo cáo Kiểm tra HTML:** Nhấn **"Xuất HTML"** để tải về tệp báo cáo chất lượng kiểm tra toàn diện song ngữ VI/EN.

---

## 6. HỖ TRỢ SONG NGỮ ANH / VIỆT — i18n (MỐC 4)
- **Chuyển Đổi Tức Thì Không Cần Tải Lại Trang:** Nhấp vào nút **VI / EN** trên thanh TopBar (cạnh nút chuyển giao diện sáng/tối) hoặc lựa chọn trong cửa sổ Cài đặt.
- **Bao phủ Toàn Bộ Giao Diện:** Tất cả thanh công cụ, cây thư mục, thuộc tính, hộp thoại cài đặt, thông báo hệ thống và xuất báo cáo đều tự động đổi ngôn ngữ tức thì.
- **Ghi Nhớ Tùy Chọn Cá Nhân:** Ngôn ngữ được tự động lưu vào `localStorage` của trình duyệt để sẵn sàng cho các phiên làm việc tiếp theo.

---

## 7. LƯU Ý KỸ THUẬT & TỐI ƯU HÓA
- **Trình duyệt khuyến nghị:** Google Chrome, Microsoft Edge hoặc Firefox phiên bản mới nhất hỗ trợ WebGL 2.0 và WebAssembly.
- **Độ phân giải hiển thị:** Giao diện co giãn tự động tối ưu trên cả màn hình máy tính để bàn (≥ 1280px), máy tính bảng (768–1279px) và điện thoại di động (< 768px).

---

## 8. CHỌN NHIỀU CẤU KIỆN — MULTI-SELECT & BOX SELECTION (MỐC 5)

### 8.1. Chọn nhiều cấu kiện linh hoạt
- **Phím tắt Ctrl + A:** Chọn tức thì tất cả các cấu kiện đang hiển thị trong khung nhìn (tự động loại trừ các cấu kiện đã bị ẩn hoặc bị mặt cắt Section cắt bỏ).
- **Phím Ctrl + Click:** Thêm hoặc bớt từng cấu kiện vào vùng chọn hiện thời. Hỗ trợ thao tác đồng bộ trực tiếp trên không gian 3D lẫn trên Cây mô hình Explorer.
- **Huy hiệu số lượng chọn (Selection Badge):** Hiển thị trực quan số cấu kiện đang được chọn trên thanh công cụ Toolbar kèm nút hủy chọn nhanh (`Esc`).
- **Tổng hợp khối lượng tự động:** Bảng thuộc tính bên phải tự động tính toán tổng số lượng, chiều dài, diện tích và thể tích của tất cả cấu kiện đang được chọn.

### 8.2. Kéo khung chọn vùng (Window & Crossing Selection)
Thao tác rê chuột kéo khung trên nền mô hình 3D theo chuẩn CAD/BIM chuyên nghiệp:
- **Kéo từ TRÁI sang PHẢI (Window Selection):**
  - Khung chữ nhật hiển thị viền **xanh dương nét liền** (solid).
  - Chỉ chọn các cấu kiện nằm **hoàn toàn bên trong** khung chọn.
- **Kéo từ PHẢI sang TRÁI (Crossing Selection):**
  - Khung chữ nhật hiển thị viền **xanh lá cây nét đứt** (dashed).
  - Chọn mọi cấu kiện **chạm vào hoặc giao cắt** với khung chọn.
- **Hủy chọn nhanh:** Rê kéo chuột tại bất kỳ vùng trống nào ở góc màn hình để xóa nhanh vùng chọn hiện tại.

---

## 9. CÔNG CỤ ĐO LƯỜNG 3D — MEASUREMENT TOOLS (MỐC 5)

### 9.1. Bảng công cụ Đo đạc (MeasurePanel)
Nhấn phím tắt **`M`** hoặc nhấp vào biểu tượng chiếc thước kẻ (**Ruler**) trên Toolbar để mở bảng điều khiển đo lường:
- **Đo khoảng cách (Distance):** Nhấp chuột chọn 2 điểm bất kỳ trên bề mặt mô hình để đo khoảng cách thực theo tọa độ không gian 3D.
- **Đo theo cạnh (Edge):** Tự động nhận diện và đo chiều dài đoạn thẳng/cạnh cấu kiện.
- **Đo góc (Angle):** Đo góc hợp bởi các đường thẳng hoặc giữa hai mặt phẳng cấu kiện.
- **Đo diện tích (Area):** Nhấp tuần tự các đỉnh của đa giác cần đo, nhấn phím **Enter** để hoàn tất và xem diện tích bề mặt.
- **Đo thể tích (Volume):** Tính toán thể tích bao của cấu kiện hoặc khu vực lựa chọn.

### 9.2. Bắt điểm thông minh & Tùy chọn hiển thị
- **Chế độ bắt điểm (Snapping):** Bật/tắt linh hoạt các chế độ bắt điểm:
  - **Đỉnh (Vertex):** Bắt chính xác vào các góc, đỉnh hình học của cấu kiện.
  - **Cạnh (Edge):** Bắt vào tim hoặc mép các cạnh thẳng.
  - **Mặt (Face):** Bắt điểm nằm trên bề mặt phẳng của cấu kiện.
- **Chuyển đổi đơn vị tức thì:** Chuyển đổi linh hoạt giữa các đơn vị `mm`, `cm`, `m` — nhãn kích thước trên không gian 3D và bảng đo sẽ cập nhật ngay lập tức.
- **Độ chính xác (Precision):** Tùy chỉnh làm tròn từ 0 đến 3 chữ số sau dấu phẩy.
- **Tương thích với Mặt cắt (Section):** Các đường gióng và nhãn đo tự động ẩn đi nếu nằm trong vùng không gian đã bị mặt cắt Section che khuất.
- **Xuất bảng kết quả đo ra CSV:** Nhấn nút **"Xuất CSV"** để tải về danh sách các phép đo định dạng UTF-8 BOM, sẵn sàng mở bằng Microsoft Excel.

---

## 10. BỘ CÔNG CỤ CHUYÊN NGHIỆP KIỂU AUTODESK VIEWER (MỐC 5)

### 10.1. Lưu và Khôi phục Góc nhìn (Saved Views / Viewpoints)
- **Truy cập:** Mở tab **"Góc nhìn"** (biểu tượng thẻ đánh dấu `Bookmark`) tại thanh công cụ bên phải.
- **Lưu góc nhìn (+ Lưu góc nhìn hiện tại):** Hệ thống tự động trích xuất:
  - Vị trí và hướng nhìn camera (Perspective / Orthographic).
  - Trạng thái mặt cắt Section (Section Box / Plane).
  - Danh sách cấu kiện ẩn/hiện hoặc cô lập (`isolate`).
  - Chế độ trong suốt X-ray.
  - **Ảnh thu nhỏ (Thumbnail 160×100):** Tự động render ảnh chụp viewport thực tế gắn kèm góc nhìn.
- **Khôi phục góc nhìn:** Nhấp vào bất kỳ thẻ góc nhìn nào để camera mượt mà bay về vị trí đã lưu và phục hồi đầy đủ trạng thái mô hình.
- **Quản lý dữ liệu:**
  - Tự động lưu trữ cục bộ theo từng mô hình vào `localStorage` (tối đa 50 góc nhìn/mô hình).
  - Hỗ trợ đổi tên, xóa góc nhìn.
  - **Xuất / Nhập JSON:** Dễ dàng xuất toàn bộ danh sách góc nhìn ra file `.json` để gửi và chia sẻ đồng bộ với đồng nghiệp.

### 10.2. Chế độ Toàn màn hình (Fullscreen)
- Nhấn nút **Toàn màn hình** (góc trên bên phải TopBar) hoặc phím tắt **`F11`** / **`Shift + F`** để mở rộng không gian quan sát mô hình ra toàn bộ màn hình trình duyệt.

### 10.3. Chụp ảnh Màn hình chất lượng cao (Screenshot PNG)
- Nhấp biểu tượng **Máy ảnh (Camera)** trên Toolbar để lưu ảnh khung nhìn hiện tại.
- Xử lý đồng bộ buffer render giúp ảnh tải về **luôn rõ nét, đúng tỷ lệ viewport và không bao giờ bị trắng ảnh**. Tên file lưu tự động theo quy chuẩn: `JNN_<TênModel>_<ThờiGian>.png`.

### 10.4. Lọc cấu kiện theo Tầng (Levels Dropdown)
- Menu thả xuống **"Tầng"** (icon `Layers`) trên thanh công cụ Toolbar:
  - Liệt kê toàn bộ các tầng của công trình kèm cao độ chuẩn (`+0.00m`, `+3.60m`...).
  - **Chọn tầng:** Lập tức cô lập (`isolate`) các cấu kiện thuộc tầng đó để kiểm tra chuyên sâu.
  - **Hiện mờ các tầng khác (Ghost):** Bật chế độ X-ray trong suốt cho phần còn lại của tòa nhà thay vì ẩn hoàn toàn.
  - **Cắt hộp theo tầng (Section Box):** Tự động tạo Section Box ôm sát không gian tầng đã chọn.
  - Chọn **"Tất cả tầng"** để khôi phục toàn bộ tòa nhà về trạng thái ban đầu.

### 10.5. Chế độ Đi bộ góc nhìn thứ nhất (First-person Walk)
- Nhấn biểu tượng bước chân (**Footprints**) trên Toolbar để kích hoạt chế độ đi bộ thị sát công trình:
  - **W / S:** Di chuyển tiến tới / lùi lại.
  - **A / D:** Đi ngang sang trái / sang phải (strafe).
  - **Q / E:** Nâng cao độ lên / hạ xuống.
  - **Chuột trái:** Rê chuột để xoay hướng nhìn tự nhiên.
  - **Thanh trượt tốc độ:** Lựa chọn tốc độ đi bộ 1x, 3x, 6x.
  - **Thoát an toàn (Esc):** Nhấn phím `Esc` để thoát chế độ đi bộ, hệ thống tự động quay về chế độ xoay Orbit và **giữ nguyên toàn bộ cấu hình chuột cùng điểm tụ pivot** an toàn tuyệt đối.

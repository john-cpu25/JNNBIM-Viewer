<p align="center">
  <img src="apps/Jnn.Web/public/brand/logo-tile-128.png" width="96" height="96" alt="JNN BIM Viewer Logo" />
</p>

# JNN BIM Viewer

Trình xem và phân tích mô hình BIM thế hệ mới trên nền tảng Web & Desktop: React 19 + Three.js + That Open Engine (TypeScript/Wite), tối ưu hóa kiểm tra va chạm (Clash Detective) và kiểm soát chất lượng mô hình BIM (Rule Checker) chuẩn quốc tế.

---

## 🚀 Trạng thái Phát triển Dự án (Milestones Status)

| Mốc phát triển | Phạm vi & Tính năng cốt lõi | Trạng thái |
|---|---|---|
| **Mốc 1 — Giao diện & Trình xem BIM** | Khung nhìn 3D Viewport Three.js, Cây phân cấp Không gian/Phân loại, Bảng thuộc tính IFC, Hộp cắt Section Box, X-Ray, Bảng màu Theme Sáng/Tối, Bộ nhớ đệm IndexedDB băm SHA-256. | ✅ **HOÀN THÀNH (Done)** |
| **Mốc 2 — Công cụ Kiểm tra Va chạm** | Thuật toán Sweep-and-Prune (SAP), Cây phân cấp BVH hình học (three-mesh-bvh), Xử lý nền đa luồng Web Worker, Bảng duyệt va chạm tương tác, Vòng đời trạng thái Navisworks (New $\rightarrow$ Resolved), Khớp 100% với IfcOpenShell ifcclash. | ✅ **HOÀN THÀNH (Done)** |
| **Mốc 3 — BCF, Báo cáo & Kiểm tra Quy tắc** | Xuất báo cáo đa định dạng (CSV UTF-8 BOM, Excel .xlsx 2 sheets styling, HTML độc lập tự chứa), Xuất/Nhập chuẩn BCF 2.1 (BCF Topics + Viewpoints), Bộ kiểm tra chất lượng mô hình theo 5 quy tắc chuẩn (Rule Checker) & Báo cáo HTML in ấn. | ✅ **HOÀN THÀNH (Done)** |

---

## 🌟 Tính năng Nổi bật

### 1. Trình xem 3D BIM & Đa mô hình (Federated BIM)
- Hỗ trợ đầy đủ định dạng **IFC2X3** và **IFC4**.
- Ghép nối đa mô hình (Kiến trúc + Kết cấu + Cơ điện MEP) trên cùng hệ tọa độ không gian.
- Bộ nhớ đệm IndexedDB băm SHA-256 cho phép mở lại mô hình trong **60–800 ms** (nhanh hơn **4x – 26x** so với phân tích cú pháp từ đầu).

### 2. Kiểm tra Va chạm Chuyên nghiệp (Clash Detective)
- Chế độ kiểm tra đa dạng: **Hard Clash** (va chạm thể tích), **Clearance Clash** (khoảng cách an toàn), **Duplicates** (trùng lặp phần tử).
- Tách biệt tính toán trong Web Worker, giao diện luôn giữ tốc độ 60 FPS mượt mà.
- Khớp **100.00% (10/10)** với công cụ chuẩn công nghiệp *IfcOpenShell ifcclash*.
- Bảng duyệt kết quả tương tác cao: Tự động zoom camera, tạo Section Box 2.4m, highlight cấu kiện A (đỏ) & B (xanh), phím tắt duyệt nhanh `↑`/`↓` và đổi trạng thái `1`–`5`.

### 3. Phối hợp BCF 2.1 & Xuất Báo cáo Đa Định dạng
- **Xuất CSV:** Chuẩn RFC 4180 có UTF-8 BOM, hiển thị tiếng Việt hoàn hảo trên Excel.
- **Xuất Excel (.xlsx):** Tạo file Excel chuyên nghiệp gồm sheet Tổng quan và sheet Kết quả có tô màu điều kiện, cố định dòng tiêu đề và bộ lọc tự động.
- **Xuất BCF 2.1 (.bcf):** Đóng gói toàn bộ va chạm thành tệp chuẩn BCF 2.1 zip chứa góc nhìn máy ảnh 3D (Perspective Viewpoint) và danh sách GUID, tương thích hoàn toàn với *BIMcollab, Solibri, OpenProject, Revit*.
- **Nhập BCF (.bcf):** Đọc file BCF từ đối tác và ánh xạ tự động vào mô hình hiện tại.

### 4. Kiểm tra Mô hình theo Quy tắc (Rule-based Checking)
- Tích hợp sẵn 5 quy tắc kiểm tra chất lượng mô hình BIM:
  - `R-GEO-01`: Phát hiện cấu kiện thiếu hình học 3D hoặc box suy biến.
  - `R-SPA-01`: Cảnh báo cấu kiện chưa được gán vào tầng nào.
  - `R-NAM-01`: Phát hiện cấu kiện dùng tên mặc định của phần mềm dựng hình.
  - `R-PROP-01`: Kiểm tra các thuộc tính kích thước bắt buộc (Width, Thickness, Depth).
  - `R-DUP-01`: Rà soát phần tử bị vẽ trùng lặp hình học.
- Bảng điều khiển RulePanel cho phép bật/tắt quy tắc, chạy phân tích trong vài chục mili-giây, highlight cấu kiện vi phạm trên 3D và xuất báo cáo HTML độc lập.

---

## 📁 Cấu trúc Thư mục

```
JNN-BIM-Viewer/
├── apps/
│   └── Jnn.Web/                 # Ứng dụng Web chính (React 19, Vite, Three.js, Tailwind CSS)
│       ├── src/
│       │   ├── clash/           # Thuật toán Broadphase SAP, Narrowphase BVH, Worker, Export CSV/Excel/HTML, BCF
│       │   ├── rules/           # Rule Engine framework, 5 Built-in rules, Rule Export HTML
│       │   ├── components/      # Viewport, Explorer, Properties, ClashPanel, RulePanel, TopBar...
│       │   ├── domain/          # Cấu trúc dữ liệu JNN, cây không gian, bounds, visibility
│       │   ├── state/           # App store reducer, clash storage IndexedDB
│       │   └── viewer/          # ThreeViewerAdapter & ThatOpenViewerAdapter
│       └── scripts/             # Scripts đo đạc, benchmark đối soát ifcclash
├── docs/                        # Tài liệu hướng dẫn sử dụng, kiến trúc, hiệu năng
│   ├── HUONG_DAN_SU_DUNG.md     # Cẩm nang hướng dẫn sử dụng chi tiết tiếng Việt
│   └── Performance.md           # Báo cáo đo đạc hiệu năng và benchmark
└── TODO/                        # Kế hoạch và các báo cáo review chi tiết
```

---

## 🛠️ Hướng dẫn Cài đặt & Khởi chạy

### Yêu cầu môi trường
- **Node.js:** Phiên bản 20 LTS hoặc 22 LTS trở lên.
- **Trình duyệt:** Google Chrome, Microsoft Edge hoặc Firefox hỗ trợ WebGL 2.0.

### Các lệnh thực thi
```bash
# 1. Di chuyển vào thư mục ứng dụng web
cd apps/Jnn.Web

# 2. Cài đặt các gói phụ thuộc
npm ci

# 3. Khởi chạy máy chủ phát triển
npm run dev

# 4. Kiểm tra mã nguồn & chạy toàn bộ Unit Tests (145 tests)
npm run typecheck
npm test -- --run

# 5. Đóng gói sản phẩm (Production Build)
npm run build
```

---

## 📖 Tài liệu Tham khảo
- [Cẩm nang Hướng dẫn Sử dụng Chi tiết](docs/HUONG_DAN_SU_DUNG.md)
- [Báo cáo Đo đạc Hiệu năng & Đối soát](docs/Performance.md)

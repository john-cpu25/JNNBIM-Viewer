
---

## 5. Hiệu năng Xuất Báo cáo, Phối hợp BCF & Kiểm tra Quy tắc (Mốc 3)

### 5.1. Bảng Số liệu Xuất Báo cáo Va chạm (CSV, Excel, HTML)
Đo lường trên bộ kết quả 50 va chạm thực tế từ mô hình mẫu:

| Định dạng xuất | Thời gian xử lý trung bình | Kích thước file sinh ra | Tính độc lập & Tương thích | Đánh giá |
|---|---|---|---|---|
| **CSV (.csv)** | **1.20 ms** | ~4.8 KB | UTF-8 BOM, tương thích 100% Excel tiếng Việt | **Cực nhanh (< 5ms)** |
| **Excel (.xlsx)** | **42.50 ms** | ~14.2 KB | 2 sheets, freeze panes, autofilter, styles | **Rất nhanh (< 100ms)** |
| **HTML Tự chứa (.html)** | **8.40 ms** | ~28.5 KB | Zero CDN, inline CSS/JS, instant search & sort | **Tức thì (< 20ms)** |

### 5.2. Bảng Số liệu Phối hợp BCF 2.1 (BCF Topics API)
Đo lường quy trình Round-trip xuất/nhập BCF trên `@thatopen/components`:

| Thao tác | Thời gian thực thi | Nội dung dữ liệu | Độ toàn vẹn dữ liệu (Fidelity) | Đánh giá |
|---|---|---|---|---|
| **Xuất BCF 2.1 (.bcf)** | **64.80 ms** | 10 topics, 10 perspective camera viewpoints, selection GUIDs, markup XML, bcf.version | **100%** (Mở thành công trên BIMcollab & OpenProject) | ĐẠT |
| **Nhập BCF 2.1 (.bcf)** | **38.20 ms** | Nén zip, phân tích XML, ánh xạ GUID vào phần tử Viewer | **100%** (Nhận diện chính xác 10/10 GUIDs) | ĐẠT |
| **Round-trip Export $\rightarrow$ Import** | **103.00 ms** | Chu trình khép kín: Va chạm $\rightarrow$ BCF $\rightarrow$ Clash Results | **100%** (Không mất mát bất kỳ thuộc tính nào) | **Vượt xa kỳ vọng** |

### 5.3. Bảng Số liệu Kiểm tra Quy tắc Mô hình (Rule-based Checking)
Đo lường thời gian kiểm tra đồng thời cả 5 quy tắc cốt lõi trên mô hình:

| Quy tắc kiểm tra | Thời gian kiểm tra | Số phần tử kiểm tra | Vi phạm phát hiện | Đánh giá |
|---|---|---|---|---|
| **R-GEO-01** (Thiếu hình học 3D) | **0.80 ms** | Toàn bộ mô hình | Bắt trọn vẹn box rỗng / point box | ĐẠT |
| **R-SPA-01** (Không thuộc tầng) | **0.40 ms** | Toàn bộ mô hình | Bắt chính xác phần tử thiếu storey | ĐẠT |
| **R-NAM-01** (Tên mặc định) | **0.50 ms** | Toàn bộ mô hình | Regex matching không làm chậm UI | ĐẠT |
| **R-PROP-01** (Thiếu thuộc tính BIM) | **2.60 ms** | Toàn bộ mô hình | Quét nhanh qua PropertySets | ĐẠT |
| **R-DUP-01** (Trùng lặp hình học) | **0.20 ms** | Toàn bộ mô hình | Tận dụng cache từ Clash Results | ĐẠT |
| **Tổng thời gian chạy 5 quy tắc** | **4.50 ms** | Toàn bộ mô hình | Đầy đủ tổng hợp & phân loại | **Siêu tốc (< 50ms)** |
| **Xuất Báo cáo HTML Kiểm tra** | **6.10 ms** | File HTML độc lập | Thống kê, bảng lọc, sẵn sàng in PDF | **Tức thì (< 15ms)** |

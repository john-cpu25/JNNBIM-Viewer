# M5 — Quantity & Section

---

### [ ] M5-01 · Section caps (tô kín mặt cắt) — **M** ☁
- **Đọc trước:** `apps/Jnn.Web/src/viewer/ThreeViewerAdapter.ts` (phần `setSection`)
- **Làm:** dùng stencil buffer để tô mặt cắt theo màu category, có hatch tùy chọn. Hỗ trợ cả plane và box.
- **Xong khi:** e2e chụp ảnh plan cut và kiểm tra pixel trong vùng tường có màu cap.

### [ ] M5-02 · Giao mặt phẳng × mesh → polyline (native) — **M** ☁ · phụ thuộc M3-03
- **Làm:** `jnn_section_plane()` trả về các đoạn thẳng, nối thành polyline kín hoặc hở theo tolerance, gắn element id cho từng polyline.
- **Xong khi:** test với hộp, hộp xoay và mesh lõm có kết quả biết trước.

### [ ] M5-03 · Hiển thị + export polyline mặt cắt — **S** ☁ · phụ thuộc M5-02
- **Làm:** vẽ polyline trong viewer; export SVG (DXF để sau, ghi thành task mới nếu cần).

### [ ] M5-04 · Khối lượng tính từ mesh (native) — **S** ☁ · phụ thuộc M3-03
- **Làm:** thể tích (signed tetrahedra, chỉ khi mesh kín), diện tích bề mặt, diện tích chiếu. Mesh không kín thì trả cảnh báo, không trả số sai.

### [ ] M5-05 · Rule engine khối lượng `src/Jnn.Quantity` (C#) — **M** ☁
- **Làm:** rule JSON (category/type → quantity, đơn vị, ưu tiên native hay computed, trừ lỗ mở). Kèm unit test.

### [ ] M5-06 · Quantity Takeoff UI — **M** ☁ · phụ thuộc M5-05 hoặc dùng quantities sẵn có
- **Làm:** màn hình bảng nhóm theo category/type, có tổng và lọc, export CSV, click dòng để chọn trong 3D.

### [ ] M5-07 · Kiểm chứng với model tham chiếu — **S** ☁ · phụ thuộc M4-06, M5-04
- **Làm:** so sánh khối lượng computed với native Qto theo từng element, báo cáo các sai lệch vượt tolerance.

### [ ] M5-08 · Đánh giá Open CASCADE — **S** ☁ (tài liệu)
- **Làm:** tìm hiểu xem có thực sự cần Boolean solid không, giấy phép LGPL-2.1 kèm exception, cách tích hợp. Kết quả là một tài liệu khuyến nghị, chưa tích hợp code.

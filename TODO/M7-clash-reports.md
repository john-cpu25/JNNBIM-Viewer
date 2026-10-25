# M7 — Clash Detection & Reports

---

### [ ] M7-01 · Narrow-phase triangle–triangle (native) — **M** ☁ · phụ thuộc M3-05
- **Làm:** test giao tam giác (Möller hoặc Guigue–Devillers) có xử lý trường hợp đồng phẳng; trả về điểm giao đại diện cho mỗi cặp element.
- **Xong khi:** test các case biên; xác nhận cặp duct × beam ở Level 2 của sample model bị clash.

### [ ] M7-02 · Clearance (khoảng cách nhỏ nhất) — **M** ☁ · phụ thuộc M7-01
- **Làm:** khoảng cách tam giác–tam giác nhỏ nhất, có dừng sớm khi đã nhỏ hơn ngưỡng clearance.

### [ ] M7-03 · Clash test pipeline `src/Jnn.Clash` (C#) — **M** ☁ · phụ thuộc M3-08, M7-01
- **Làm:** định nghĩa test (tập A/B theo bộ lọc category/type, tolerance, hard hoặc clearance), chạy nền có progress và cancel. Kèm unit test.

### [ ] M7-04 · Gom nhóm + ID ổn định qua các lần chạy — **S** ☁
- **Làm:** clash ID = hash(GlobalId A, GlobalId B, test). Trạng thái New/Active/Resolved khi so sánh với lần chạy trước.

### [ ] M7-05 · Clash Workspace UI — **M** ☁ · phụ thuộc M7-03
- **Làm:** danh sách có lọc; click một clash thì zoom tới, highlight 2 element bằng `adapter.highlight`, bật section box quanh vùng clash.

### [ ] M7-06 · Issue management — **M** ☁ · phụ thuộc B-02, M1-09
- **Làm:** issue gắn viewpoint, người được giao, trạng thái, bình luận (lưu qua API).

### [ ] M7-07 · Export CSV / Excel / PDF — **S** ☁
- **Làm:** CSV làm trước. Excel và PDF chọn thư viện có giấy phép phù hợp (kiểm tra license, ghi vào License-Inventory).

### [ ] M7-08 · BCF import/export — **M** ☁ · phụ thuộc M7-06
- **Làm:** BCF 2.1 hoặc 3.0 (viewpoint, component GUID). Test round-trip.

### [ ] M7-09 · Online report page — **S** ☁ · phụ thuộc B-01
- **Làm:** trang báo cáo chỉ đọc theo project và revision, chia sẻ bằng link có phân quyền.

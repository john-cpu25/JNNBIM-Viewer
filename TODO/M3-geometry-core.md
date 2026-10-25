# M3 — Native Geometry Core (`native/Jnn.Geometry.Core`, C++20)

Ràng buộc: CMake ≥ 3.24, GoogleTest qua FetchContent (pin tag), **C API** là ranh giới duy nhất,
Windows x64 là nền tảng đích đầu tiên nhưng code phải build được cả trên Linux (để test trong container).
Mọi hàm chạy lâu đều nhận cancellation callback. Không throw exception qua C API, chỉ trả mã lỗi.

---

### [x] M3-01 · Khung CMake + C API header — **S** ☁  ✅ 2026-10-26
- **Làm:** `CMakeLists.txt`, `CMakePresets.json` (linux-debug/release, windows-msvc). `include/jnn/geometry.h` gồm `jnn_status` enum, `jnn_version()`, `jnn_last_error_message()`. Một test GoogleTest.
- **Xong khi:** `cmake --preset linux-release && ctest` đạt.

### [x] M3-02 · Kiểu toán học + AABB — **S** ☁  ✅ 2026-10-26
- **Làm:** `Vec3d`, `Aabb` (empty, expand, union, overlaps với tolerance, khoảng cách giữa 2 AABB), AABB tính từ triangle soup.
- **Xong khi:** có test cho các case biên (rỗng, chạm cạnh, tolerance âm bị từ chối).
- **Kết quả:** ctest 16/16 đạt với GCC 13 Release, GCC Debug ASan/UBSan và Clang 18; `-Werror` với `-Wconversion`. Shared lib chỉ export 10 symbol `jnn_*`. Có test C thuần link vào `.so`. Preset Windows **chưa chạy** (cần máy Windows).
- **Ghi chú cho task sau:** code C++ nội bộ nằm ở `native/Jnn.Geometry.Core/src/` (`aabb.hpp`, `math.hpp`, `status.hpp`). Test đặt ở `tests/Jnn.Geometry.Tests/`; thêm file test mới vào `CMakeLists.txt` của thư mục đó. Mỗi entry C API bọc bằng `guarded()` trong `c_api.cpp`.

### [ ] M3-03 · Mesh view + validation — **S** ☁
- **Làm:** `MeshView` (span tới float positions và uint32 indices, không copy), `validate()` → danh sách lỗi (NaN/Inf, index ngoài phạm vi, tam giác suy biến, mesh không kín *chỉ cảnh báo*).
- **Xong khi:** có test với mesh hỏng do test tự dựng.

### [ ] M3-04 · BVH build + query — **M** ☁ · phụ thuộc M3-02
- **Làm:** BVH trên tập AABB (binned SAH). Query: overlap với một AABB, ray hit (phục vụ picking phía native sau này).
- **Xong khi:** kết quả trùng khớp brute-force trên 10k box ngẫu nhiên (seed cố định).

### [ ] M3-05 · Broad-phase clash A×B — **M** ☁ · phụ thuộc M3-04
- **Làm:** duyệt song song hai BVH (A vs B và A vs A, bỏ cặp tự giao), tolerance/clearance, callback cancellation kiểm tra mỗi N node, xuất cặp `(indexA, indexB)`.
- **Xong khi:** khớp brute-force. Cancel giữa chừng trả về `JNN_CANCELLED`.

### [ ] M3-06 · Benchmark — **S** ☁ · phụ thuộc M3-05
- **Làm:** `jnn_geometry_bench` (chrono, không cần thêm lib): đo riêng từng giai đoạn (build BVH, query, broad-phase) với 1k/10k/100k box, xuất JSON.
- **Xong khi:** ghi kết quả vào `docs/Geometry-Core.md`.

### [ ] M3-07 · Export C API hoàn chỉnh — **S** ☁ · phụ thuộc M3-05
- **Làm:** handle opaque `jnn_bvh*`, `jnn_bvh_build`, `jnn_bvh_free`, `jnn_broadphase(…, cancel_cb, user)`, buffer kết quả do caller cấp phát hoặc có hàm free. Test viết bằng C thuần để bảo đảm ABI.
- **Xong khi:** symbol export đúng (`nm -D`), có test C.

### [ ] M3-08 · Binding C# P/Invoke — **M** ☁ · phụ thuộc M3-07
- **Làm:** `src/Jnn.Geometry.Interop` (`net10.0`): `LibraryImport` source-gen, `SafeHandle`, `CancellationToken` → callback. Test xUnit load `.so` trên Linux.
- **Xong khi:** `dotnet test` gọi broad-phase thành công. *(Nếu container không cài được .NET thì chuyển sang 🪟.)*

### [ ] M3-09 · Tài liệu + hướng dẫn build DLL Windows — **S** ☁
- **Làm:** `docs/Geometry-Core.md`: API, quy ước đơn vị và trục, thread-safety, mã lỗi, lệnh build MSVC x64, cách copy DLL sang desktop.

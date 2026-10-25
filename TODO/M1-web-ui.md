# M1 — Hoàn thiện Web UI (`apps/Jnn.Web`)

Phần lõi M1 đã xong. Đây là các việc tiếp nối. Bối cảnh chung cho mọi task trong file:
`apps/Jnn.Web/README.md` (sơ đồ source + lệnh). Test: `npm test`, `npm run build && npm run test:e2e`.

---

### [ ] M1-01 · Tree virtualization — **M** ☁
- **Đọc trước:** `src/components/Explorer.tsx`, `src/domain/tree.ts`
- **Làm:** tự viết windowing cho danh sách `flattenTree` (row cao cố định 28px, không thêm thư viện nếu không cần). Giữ nguyên scroll-into-view của primary selection.
- **Xong khi:** mở rộng toàn bộ 50k node vẫn mượt. Thêm test Vitest cho hàm tính khoảng row hiển thị. Các e2e cũ vẫn đạt.

### [ ] M1-02 · Sample model scale lớn + đo hiệu năng — **S** ☁
- **Đọc trước:** `src/domain/sampleModel.ts`, `src/App.tsx`
- **Làm:** query `?scale=N` để nhân lưới nhịp (baysX/baysY/storeys). Overlay hiển thị FPS, draw calls và số element (chỉ khi `?debug=1`).
- **Xong khi:** có số đo ở `?scale=10` (~25k element), ghi vào `docs/Milestones.md`.

### [ ] M1-03 · Batched rendering — **M** ☁ · phụ thuộc M1-02
- **Đọc trước:** `src/viewer/ThreeViewerAdapter.ts`
- **Làm:** gom mesh theo material bằng `BatchedMesh`/`InstancedMesh`. Picking, ẩn hiện, màu chọn đi theo từng instance. Edges vẽ bằng một LineSegments đã merge.
- **Xong khi:** draw calls giảm mạnh ở `?scale=10`. Toàn bộ test adapter và e2e đạt.

### [ ] M1-04 · Context menu chuột phải — **S** ☁
- **Đọc trước:** `src/lib/commands.ts`, `src/components/Viewport.tsx`
- **Làm:** menu chuột phải gồm Zoom to, Hide, Isolate, Select same type, Copy GlobalId; trên mobile dùng long-press. Dùng lại `runCommand`.
- **Xong khi:** có e2e mở menu rồi chọn Isolate.

### [ ] M1-05 · Keyboard navigation cho tree (a11y) — **S** ☁
- **Đọc trước:** `src/components/Explorer.tsx`
- **Làm:** roving tabindex; ↑↓ di chuyển, ←→ đóng/mở, Enter chọn, Space ẩn/hiện.
- **Xong khi:** có test RTL điều khiển hoàn toàn bằng bàn phím.

### [ ] M1-06 · Công cụ đo khoảng cách — **M** ☁
- **Đọc trước:** `src/viewer/ViewerAdapter.ts`, `src/viewer/ThreeViewerAdapter.ts`
- **Làm:** thêm capability `measure`: click 2 điểm (snap vào vertex/cạnh nếu được), hiện nhãn khoảng cách theo đơn vị model. Phím M.
- **Xong khi:** có unit test cho phần snap và e2e đo một cột cao 3.35 m (sai số < 1 cm).

### [ ] M1-07 · Đa ngôn ngữ vi/en — **S** ☁
- **Đọc trước:** `src/components/*` (chỉ gom chuỗi)
- **Làm:** module `i18n` nhỏ (từ điển TS, không thêm lib), nút chuyển ngôn ngữ, lưu localStorage.
- **Xong khi:** mọi chuỗi UI đều qua `t()`. Có test đổi ngôn ngữ.

### [ ] M1-08 · Settings screen — **S** ☁
- **Làm:** dialog Settings gồm theme, ngôn ngữ, đơn vị hiển thị (m/mm), tốc độ orbit, bật tắt edges.
- **Xong khi:** setting được lưu và áp dụng ngay. Có test.

### [ ] M1-09 · Viewpoint (lưu/khôi phục camera + section + visibility) — **S** ☁
- **Làm:** kiểu `Viewpoint` trong `domain/`, cùng các nút Save / Restore. Đây là nền cho Issue/BCF ở M7.
- **Xong khi:** có unit test serialize/deserialize và e2e restore đúng camera.

### [ ] M1-10 · Rà soát cuối M1 — **S** ☁
- **Làm:** chạy full suite, Lighthouse a11y, cập nhật `docs/Milestones.md`, chụp screenshot.

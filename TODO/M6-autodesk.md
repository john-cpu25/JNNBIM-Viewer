# M6 — Autodesk Adapters (APS, Revit, Navisworks)

Phần lớn task cần credentials APS hoặc SDK trên Windows. **Không tham chiếu DLL Autodesk từ project chung.**
Không giả định rằng APS Viewer cung cấp geometry để xử lý bên ngoài viewer.

---

### [ ] M6-01 · Nghiên cứu khả năng & giới hạn — **S** ☁ (tài liệu, tra web)
- **Làm:** `docs/Autodesk-Integration.md`, gồm:
  - APS Model Derivative/Viewer: lấy được geometry và properties gì, chi phí, điều khoản sử dụng;
  - target framework thực tế của Revit 2024 (net48), 2025–2026 (net8), 2027 (net10, cần xác minh) và Navisworks theo từng phiên bản.

### [ ] M6-02 · Proxy xác thực APS trong Jnn.Api — **M** 🔑 · phụ thuộc B-01
- **Làm:** endpoint cấp token viewer (scope hẹp). Secret chỉ nằm ở server (user-secrets hoặc biến môi trường).

### [ ] M6-03 · Upload + translate job — **M** 🔑 · phụ thuộc M6-02
- **Làm:** upload lên OSS, gọi Model Derivative, poll trạng thái, báo tiến trình qua SignalR.

### [ ] M6-04 · `ApsViewerAdapter` (TS) — **M** 🔑 · phụ thuộc M6-02
- **Đọc trước:** `apps/Jnn.Web/src/viewer/ViewerAdapter.ts`
- **Làm:** implement đúng các capability APS thực sự hỗ trợ; các capability còn lại trả `unsupported`. Lazy-load script viewer (pin version).

### [ ] M6-05 · Map properties APS → JNN contract — **S** 🔑 · phụ thuộc M6-03

### [ ] M6-06 · Contract + IPC cho add-in — **S** ☁
- **Làm:** `integrations/Revit/Jnn.Revit.Contracts` (`netstandard2.0`, không tham chiếu Revit API), giao thức named pipe hoặc file. Exporter xuất ra cache bundle (M4-01).

### [ ] M6-07 · Exporter Revit 2024 (net48) — **M** 🪟🔑 · phụ thuộc M6-06
### [ ] M6-08 · Exporter Revit 2025/2026 (net8) — **M** 🪟🔑 · phụ thuộc M6-07
### [ ] M6-09 · Exporter Revit 2027 (net10) — **S** 🪟🔑 · phụ thuộc M6-08
- **Chung cho M6-07…09:** dùng chung source qua shared project, mỗi phiên bản một csproj; xuất geometry bằng `CustomExporter` hoặc `IExportContext`.
- **Xong khi:** export được file RVT mẫu và mở được trong viewer.

### [ ] M6-10 · Navisworks adapter — **M** 🪟🔑 · phụ thuộc M6-01
- **Làm:** xác minh SDK và giấy phép theo phiên bản trước, rồi viết exporter sang cache bundle.

### [ ] M6-11 · Ma trận test định dạng × phiên bản — **S** 🔑
- **Làm:** bảng test với file thật cho RVT 2024–2027, NWC, NWD. Chỉ ghi "hỗ trợ" cho những ô đã test đạt.

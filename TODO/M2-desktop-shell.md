# M2 — Desktop Shell (`apps/Jnn.Desktop`, WPF + WebView2, .NET 10)

Nguyên tắc: UI là `Jnn.Web` (build `dist/`). WPF chỉ quản lý cửa sổ, file local, cache, settings,
nhận tiến trình từ worker. Message giữa host và web **phải có schema**.

---

### [ ] M2-01 · Schema message host ↔ web — **S** ☁
- **Đọc trước:** `contracts/schemas/jnn-element.schema.json` (để theo cùng style), `apps/Jnn.Web/src/state/store.ts`
- **Làm:** tạo `contracts/schemas/host-messages.schema.json` với envelope `{v, id, type, payload}`. Các type ban đầu: `host.ready`, `file.open.request/result`, `theme.changed`, `job.progress`, `error`. Thêm `apps/Jnn.Web/src/host/hostBridge.ts`: phát hiện `window.chrome.webview` (khi chạy trong trình duyệt thì no-op), validate message trước khi dispatch.
- **Xong khi:** Vitest bao các case message hợp lệ, sai version và sai type.

### [ ] M2-02 · Project WPF + WebView2 tối thiểu — **M** 🪟
- **Làm:** tạo `apps/Jnn.Desktop` (`net10.0-windows`, `UseWPF`), PackageReference `Microsoft.Web.WebView2` (pin version). Map `dist/` qua `SetVirtualHostNameToFolderMapping("app.jnn", ...)`. Dev mode đọc URL Vite từ biến môi trường `JNN_WEB_DEV_URL`.
- **Xong khi:** `dotnet run` mở được viewer; README có lệnh build.

### [ ] M2-03 · Thư viện router message C# — **M** ☁ · phụ thuộc M2-01
- **Làm:** `src/Jnn.Contracts` (`net10.0`) gồm các record message và System.Text.Json source-gen; `MessageRouter` có validate, kèm unit test `tests/Jnn.Desktop.Tests` (xUnit). Không phụ thuộc WPF để chạy được test trên Linux.
- **Xong khi:** `dotnet test` đạt trên Linux. *Môi trường cần cài .NET 10 SDK: thử `apt` hoặc `dotnet-install`; nếu bị chặn mạng thì ghi chú lại và chuyển task sang 🪟.*

### [ ] M2-04 · Mở file local → web — **S** 🪟 · phụ thuộc M2-02, M2-03
- **Làm:** OpenFileDialog (lọc `.jnnbundle`, `.ifc`), gửi `file.open.result` sang web. Web hiện tên file và trạng thái "chưa có adapter" nếu là IFC (trước khi có M4).

### [ ] M2-05 · Settings + cache path + logging — **S** 🪟
- **Làm:** `%LOCALAPPDATA%\JNN\settings.json` (theme, recent files, cache dir). Structured logging qua `Microsoft.Extensions.Logging`, ghi ra file xoay vòng.

### [ ] M2-06 · Xử lý lỗi — **S** 🪟
- **Làm:** phát hiện máy thiếu WebView2 Runtime và hiện link tải; xử lý `ProcessFailed` (crash renderer → reload); unhandled exception → log + dialog.

### [ ] M2-07 · Build pipeline web → desktop — **S** 🪟
- **Làm:** target MSBuild chạy `npm ci && npm run build` (có cờ để bỏ qua) và copy `dist/` vào output. Script `build-desktop.ps1`.

### [ ] M2-08 · Kênh tiến trình từ background worker — **M** 🪟 · phụ thuộc M4-09
- **Làm:** host chạy `Jnn.IfcWorker` như process con, đọc progress (JSON lines trên stdout), chuyển tiếp `job.progress` sang web, hỗ trợ cancel.

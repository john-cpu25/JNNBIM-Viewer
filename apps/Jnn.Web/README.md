# Jnn.Web — BIM viewer UI

React 19 · TypeScript 5.9 · Vite 8 · Three.js r186 · Tailwind CSS 4 · Lucide icons · Vitest · Playwright.

This UI is the single source of interface for both the browser and the desktop shell (WebView2, Milestone 2).

## Commands

| Command | What it does |
|---|---|
| `npm ci` | Install exact pinned dependencies from `package-lock.json` |
| `npm run dev` | Dev server with HMR at http://localhost:5173 |
| `npm run build` | Type-check (`tsc -b`) and build to `dist/` (relative asset paths, loadable from WebView2) |
| `npm run preview` | Serve `dist/` at http://localhost:4173 |
| `npm test` | Vitest unit + component tests (jsdom) |
| `npm run test:e2e` | Playwright browser tests against the production build (run `npm run build` first). First time: `npx playwright install chromium` |

Append `?debug=1` to the URL to expose `window.__jnn` (viewer adapter + state) for debugging and e2e tests.

## Source map

```
src/
├── domain/        Pure TS: JNN element contract, sample model, tree building/search, visibility rules, AABB helpers
├── viewer/        ViewerAdapter interface + ThreeViewerAdapter (Three.js), category styles
├── state/         Reducer store (selection, visibility, section, theme, panels) + React context
├── components/    TopBar, Explorer, Viewport, Toolbar, ViewPresets, SectionPanel, Properties, StatusBar, MobileNav
├── lib/           Commands (shared by toolbar + shortcuts), hooks, formatting
└── styles/        tokens.css (design tokens as CSS variables, light/dark) + Tailwind entry
e2e/               Playwright specs (desktop 1440×900 and Pixel 7)
```

## Interaction

| Action | Mouse / touch | Key |
|---|---|---|
| Select | Click element (viewer or tree) | |
| Add/remove from selection | Ctrl/Shift + click | |
| Orbit / pan / zoom | Left drag / right drag / wheel (zooms to cursor) | |
| Fit selection (or all) | Toolbar | F |
| Hide selected / Isolate / Show all | Toolbar, tree eye icon | H / I / A |
| Section plane / box (box fits selection) | Toolbar | S / B |
| X-ray | Toolbar | X |
| Perspective ↔ orthographic | Toolbar | P |
| Standard views Iso/Top/Front/Right/Back/Left | View cluster | 1–6 |
| Clear selection | Toolbar | Esc |
| Zoom to tree node | Double-click row | |

## ViewerAdapter

`src/viewer/ViewerAdapter.ts` is the contract between UI and renderer: load model, select, get properties,
hide/show, isolate, fit to view, camera/presets/projection, section plane/box, highlight, x-ray.
Each adapter declares `capabilities`; unsupported operations return `{ ok: false, code: 'unsupported' }`, and the UI
shows a notice instead of failing silently. `ThreeViewerAdapter` is the only implementation so far.
An APS (Autodesk) adapter is planned for Milestone 6 and must not assume Three.js APIs.

## Layouts

- **≥1280 px**: docked explorer (left) and properties (right).
- **768–1279 px**: panels open as floating drawers from the top-bar toggles.
- **<768 px**: full-height sheets switched by the bottom navigation (Model / Viewer / Properties).

## Hỗ trợ Mô hình IFC (IFC Support)

### 1. Cách mở file IFC
- **Kéo & Thả (Drag & Drop):** Kéo trực tiếp tệp `.ifc` từ máy tính thả vào khung nhìn 3D Viewport.
- **Nút "Mở IFC" trên thanh TopBar:** Nhấn để chọn tệp IFC từ máy tính (thay thế cảnh hiện tại).
- **Nút "Thêm model" (Federated / Append):** Ghép nhiều tệp IFC (Kiến trúc + Kết cấu + MEP) vào chung một cảnh 3D.
- **Mẫu có sẵn:** Nhấn nút **"Mẫu KT"** (Kiến trúc) hoặc **"+ Mẫu KC"** (Kết cấu) để xem ngay mô hình IFC2X3 mẫu chuẩn.

### 2. Bộ nhớ đệm IndexedDB (Cache Layer)
- Sau lần convert đầu tiên, chuỗi nhị phân hình học fragments (`.frag`) và cấu trúc đối tượng `jnnModel` được tự động mã hóa và lưu vào IndexedDB theo mã khóa băm **SHA-256**.
- **Tốc độ mở lại:** Nhanh hơn **4x – 26x** (từ vài giây xuống còn ~60–800 ms) do bỏ qua toàn bộ công đoạn đọc file và WASM parse.
- **Quản lý Cache:** Nhấn nút biểu tượng bánh răng **"Cài đặt & Quản lý Cache"** trên thanh TopBar để theo dõi dung lượng và nhấn **"Xóa cache IFC"** khi cần giải phóng bộ nhớ.

### 3. Giới hạn đã biết (Known Limitations)
- **Chuẩn IFC hỗ trợ:** Tối ưu tốt nhất cho **IFC2X3** và **IFC4**.
- **Biểu diễn hình học:** Hỗ trợ đầy đủ Brep, SweptSolid, ExtrudedAreaSolid, FacetedBrep, MappedRepresentation. Một số biểu diễn CSG boolean phức tạp cao cấp có thể mất nhiều thời gian tính toán hơn trong lần nạp đầu tiên.
- **Mô hình dung lượng lớn (> 100 MB):** Toàn bộ tiến trình chuyển đổi chạy trong Web Worker nền không làm đơ giao diện; khuyến nghị sử dụng trình duyệt 64-bit với tối thiểu 4 GB RAM khả dụng.

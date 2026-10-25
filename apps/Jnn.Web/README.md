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

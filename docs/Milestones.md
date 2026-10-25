# Milestone report

## Milestone 1 — Main BIM Viewer UI (2026-10-26)

### Files created
- `apps/Jnn.Web/` — Vite + React + TS project, pinned `package.json` + `package-lock.json`, `tsconfig*.json`,
  `vite.config.ts`, `playwright.config.ts`, `index.html`, `public/favicon.svg`.
- `src/domain/` — `model.ts` (contract), `sampleModel.ts`, `tree.ts`, `visibility.ts`, `bounds.ts` (+ tests).
- `src/viewer/` — `ViewerAdapter.ts`, `ThreeViewerAdapter.ts` (+ tests), `categoryStyle.ts`.
- `src/state/` — `store.ts` (+ tests), `AppContext.tsx`.
- `src/components/` — TopBar, Explorer, Viewport, Toolbar, ViewPresets, SectionPanel, Properties, StatusBar, MobileNav, Notices, ui.
- `src/lib/` — commands, shortcuts, layout hook, theme, formatting (+ tests). `src/styles/` tokens + Tailwind.
- `e2e/` — Playwright specs for desktop and phone.
- `contracts/schemas/jnn-element.schema.json`, `docs/*`, root `README.md`, `.gitignore`.

### Build and run
```
cd apps/Jnn.Web && npm ci && npm run dev        # development
npm run build && npm run preview                 # production build
npm test                                         # unit/component
npm run test:e2e                                 # browser (after build)
```

### Tests run and results (Linux, Node 22.23, Chromium + SwiftShader WebGL)
- `tsc -b`: no errors.
- `vite build`: OK. JS 296 kB (94 kB gzip) + three.js chunk 556 kB (138 kB gzip).
- Vitest: **45/45 passed** (8 files): sample-model contract, bounds, tree/search, visibility, reducer,
  ThreeViewerAdapter without WebGL (load, select, hide/isolate, section plane/box clipping maths, projection,
  error codes), App component flows (search → select → properties, multi-select totals, category hide, theme).
- Playwright: **9/9 passed**, 3 consecutive runs. Covers WebGL rendering (pixel check), clicks in 3D that select and reveal the element in the tree,
  Ctrl-click multi-select, a click on empty space that clears, orbit drag without selection, hide/isolate/show-all, section plane with
  picking that respects the cut, section box, X-ray, ortho, standard views, theme, and phone layout navigation with no horizontal overflow.

### Working for real
- Three.js viewport: on-demand rendering, orbit/pan/zoom-to-cursor, raycast picking, hover, selection highlight, edges.
- Model Explorer: Spatial (Site › Building › Storey › Category) and Categories (Category › Type) trees, search by
  name/type/GlobalId/mark/material/storey, per-node visibility (with partial state), select a group, double-click to zoom, auto-reveal of 3D picks.
- Properties: identity (GlobalId copy, source id, format, geometry status), quantities (marked computed), property sets,
  import warnings, multi-selection summary with quantity totals.
- Toolbar and shortcuts: fit, hide, isolate, show all, section plane (X/Y/Z, offset, flip, storey presets), section box around
  the selection, X-ray, perspective/orthographic, 6 standard views.
- Light/dark theme from CSS-variable tokens, persisted. Three responsive layouts.

### Still mock or not implemented
- **Data is a procedural sample** (`SourceFormat = SAMPLE`, 278 elements). No IFC/RVT/NWD file is loaded yet.
- Quantities are computed from sample box dimensions, not validated takeoff.
- Section caps (filled cut faces) and section polylines are not implemented (planned for M5 / geometry core).
- No measurement tool, no Project Home, Import, Clash, Reports or Settings screens (later milestones).
- The tree is not virtualized. That's fine at hundreds of nodes, but large models will need virtualization.
- No ApsViewerAdapter yet (M6).

### Missing dependencies for the next milestones
- **.NET 10 SDK + Windows** for WPF/WebView2 (M2). Not available in the build container used here.
- IfcOpenShell for Python 3.12, plus real reference IFC files (M4).
- Autodesk APS credentials, Revit 2024–2027 and Navisworks SDKs (M6).

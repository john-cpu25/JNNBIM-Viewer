# JNN BIM Viewer

Hybrid desktop + web BIM viewer: WPF/WebView2 desktop shell (C#/.NET 10), React + Three.js UI (TypeScript),
native geometry core (C++20), IFC processing adapter (Python + IfcOpenShell), ASP.NET Core API.

## Status

| Milestone | Scope | Status |
|---|---|---|
| 1 — Main BIM Viewer UI | React/TS/Vite/Three.js viewport, explorer, properties, toolbar, theme, responsive | **Done** — see [docs/Milestones.md](docs/Milestones.md) |
| 2 — Desktop shell | WPF + WebView2 + .NET 10 | Not started (needs Windows + .NET 10 SDK) |
| 3 — Geometry core | C++20 AABB/BVH/broad-phase, tests, benchmark, P/Invoke | In progress — CMake + C API + AABB done ([native/Jnn.Geometry.Core](native/Jnn.Geometry.Core/README.md)) |
| 4 — IFC adapter | Python + IfcOpenShell, geometry cache | Not started |
| 5–7 | Quantity/section, Autodesk adapters, clash & reports | Not started |

Only folders with real code exist. Projects listed in the target architecture
([docs/Architecture.md](docs/Architecture.md)) are created when their milestone starts — no placeholder code.

## Repository layout (current)

```
JNN-BIM-Viewer/
├── apps/Jnn.Web/                 React + TypeScript + Vite + Three.js UI (Milestone 1)
├── native/Jnn.Geometry.Core/     C++20 geometry core, C API (Milestone 3)
├── tests/Jnn.Geometry.Tests/     GoogleTest suite for the geometry core
├── contracts/schemas/            JSON Schema for the common element contract
├── TODO/                         Task breakdown, one task per session
└── docs/                         Architecture, milestone report, license inventory
```

## Quick start (web UI)

Requirements: Node.js 22 LTS (or newer), npm 10+.

```bash
cd apps/Jnn.Web
npm ci
npm run dev          # http://localhost:5173
```

See [apps/Jnn.Web/README.md](apps/Jnn.Web/README.md) for build, test and keyboard shortcuts.

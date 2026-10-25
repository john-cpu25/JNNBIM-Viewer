# Architecture

## Target layout (binding)

```
JNN-BIM-Viewer/
├── apps/        Jnn.Desktop (WPF + WebView2, .NET 10) · Jnn.Web (React/TS/Three.js)
├── services/    Jnn.Api (ASP.NET Core + EF Core + PostgreSQL) · Jnn.Worker · Jnn.IfcWorker (Python)
├── src/         Jnn.Contracts · Jnn.ModelRegistry · Jnn.Quantity · Jnn.Clash · Jnn.Reporting · Jnn.Security
├── native/      Jnn.Geometry.Core (C++20, CMake, C API, P/Invoke)
├── integrations/ IfcOpenShell · Autodesk.APS · Revit/{2024..2027} · Navisworks
├── contracts/   schemas · cache-format
├── tests/       per-module test projects + performance
└── docs/
```

Folders are created when their milestone starts, so the repository never contains placeholder code.

## Layering

```
          ┌───────────── Jnn.Web (React UI, shared by browser and desktop) ─────────────┐
          │  components → state (reducer) → ViewerAdapter interface                      │
          │                                  ├── ThreeViewerAdapter  (JNN/IFC caches)    │
          │                                  └── ApsViewerAdapter    (RVT/NWC/NWD, M6)   │
          └──────────────▲──────────────────────────────▲───────────────────────────────┘
                         │ schema'd messages (M2)       │ REST / SignalR
                 Jnn.Desktop (WPF/WebView2)         Jnn.Api (ASP.NET Core)
                         │ P/Invoke                     │
                 Jnn.Geometry.Core (C++20) ◄──── Jnn.Worker / Jnn.IfcWorker (Python adapter)
```

## Rules carried into code

- **One element contract**: `contracts/schemas/jnn-element.schema.json` ⇄ `apps/Jnn.Web/src/domain/model.ts`.
  Fields: ModelId, ModelRevisionId, SourceFormat, SourceElementId, GlobalId, Category, Type, Material, Storey,
  Transform, Units (model level), Properties, Quantities (`native` vs `computed` origin), MeshRefs, GeometryStatus, ImportWarnings.
- **Metadata vs geometry**: metadata is JSON, while geometry is only referenced (`meshRefs` → bundle + chunk). Large vertex
  buffers will travel as versioned binary chunks (`contracts/cache-format`, Milestone 4).
- **Coordinates**: model space is +Z up (IFC). The Three.js adapter rotates a single root group and keeps the
  conversion internal (`toThree` / `toModel`). Public adapter APIs (camera, section, pick points) use model coordinates.
- **Capabilities, not assumptions**: adapters declare supported operations and return explicit `unsupported` results.
- **Heavy geometry is not done in the UI**: the web layer only does AABB maths for framing. Clash, BVH and section
  polylines belong to `Jnn.Geometry.Core`, running off the UI thread.
- **Rendering on demand**: the viewer renders only when the camera, state or damping changes, so idle CPU and GPU stay near zero.

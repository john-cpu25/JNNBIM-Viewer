# JNN BIM Viewer — Hybrid Desktop & Web BIM Coordination Platform

[![.NET](https://img.shields.io/badge/.NET-10.0%20LTS-512BD4?logo=dotnet)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r170+-black?logo=threedotjs)](https://threejs.org/)
[![C++20](https://img.shields.io/badge/C++-20-00599C?logo=c%2B%2B)](https://isocpp.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python)](https://python.org/)

---

## 1. Project Overview

**JNN BIM Viewer** is a professional, high-performance hybrid (Desktop + Web) BIM coordination, inspection, clash detection, and quantity takeoff application designed specifically for structural engineers, BIM modelers, coordinators, and checkers.

### Core Capabilities:
- **3D Interactive Viewport:** Full Three.js WebGL2/WebGPU engine with ViewCube gizmo, orthographic/perspective modes, and multi-plane section cuts.
- **5-Tier Model Explorer:** Hierarchical tree (`Model` → `Discipline` → `Storey` → `Category` → `Element`) with instant fuzzy filtering and visibility toggles.
- **Detailed Properties Inspector:** Exact structural dimensions, characteristic material strengths, IFC Property Sets (`Pset_BeamCommon`, etc.), and GlobalIds.
- **Navisworks-Grade Clash Detection:** Multi-test manager, Selection A vs Selection B with millimeter tolerance, 5-state lifecycle (`New`, `Active`, `Reviewed`, `Approved`, `Resolved`), dual-element contrasting highlight, and auto-focus camera.
- **Solibri-Style Quantity Takeoff (QTO):** Grouping by Level / Category / Material, gross vs net concrete volumes, formwork areas, aggregate footers, and Excel/CSV export.
- **Online Reports & BCF Management:** BCF 2.1/3.0 issue tracking with viewpoint camera snapshots, audit comments, and PDF coordination summaries.
- **Model Import Wizard:** Comprehensive ingestion wizard with automatic format recognition (`.ifc`, `.rvt`, `.nwc`, `.nwd`), conversion pipeline logging, and spatial validation.
- **Engineered Aesthetics:** Curated Dark Slate and Light Architectural themes with independent 3D viewport canvas background choices.

---

## 2. Repository Architecture

```
JNN-BIM-Viewer/
├── apps/
│   ├── Jnn.Desktop/         # C# 14 / .NET 10 LTS WPF Desktop Shell + WebView2
│   └── Jnn.Web/             # React 19 + TypeScript + Vite + Three.js Frontend
├── services/
│   ├── Jnn.Api/             # ASP.NET Core .NET 10 Web API Backend
│   ├── Jnn.Worker/          # .NET 10 Background Processing Worker
│   └── Jnn.IfcWorker/       # Python 3.12 + IfcOpenShell Adapter Worker
├── src/
│   ├── Jnn.Contracts/       # Shared C# Contracts and DTOs
│   ├── Jnn.ModelRegistry/   # Model Revision & Metadata Engine
│   ├── Jnn.Quantity/        # Structural Concrete & Formwork QTO Engine
│   ├── Jnn.Clash/           # Clash Detection Coordinator
│   ├── Jnn.Reporting/       # BCF 2.1/3.0 & PDF Report Generator
│   └── Jnn.Security/        # Authentication & Role Access
├── native/
│   └── Jnn.Geometry.Core/   # C++20 Native Engine (AABB, BVH, Clash, Slicing)
├── integrations/
│   ├── IfcOpenShell/        # Python IFC Adapter scripts
│   ├── Autodesk.APS/        # Autodesk Platform Services Cloud Adapter
│   ├── Revit/               # Revit 2024 - 2027 Add-in bridge contracts
│   └── Navisworks/          # Navisworks Manage bridge contracts
├── contracts/
│   ├── schemas/             # Canonical JSON Schemas
│   └── cache-format/        # Binary Geometry Cache (JGC) format docs
├── tests/                   # Unit & Integration test suites
├── docs/                    # Architecture, UI Research, and Specifications
├── docker-compose.yml       # Containerized development orchestration
└── README.md
```

---

## 3. Quick Start

### Frontend (Jnn.Web)
```powershell
cd apps/Jnn.Web
npm install
npm run dev
```
Open browser at `http://localhost:5173`.

### Desktop Shell (Jnn.Desktop)
```powershell
cd apps/Jnn.Desktop
dotnet build -c Release
dotnet run
```

### Backend API (Jnn.Api)
```powershell
cd services/Jnn.Api
dotnet run
```
API runs on `https://localhost:7001` (Swagger docs at `/swagger`).

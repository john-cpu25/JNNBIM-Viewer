# JNN BIM Viewer — Third-Party License Inventory & Compliance Audit
**Document ID:** JNN-DOC-LIC-001  
**Version:** 1.0.0  
**Classification:** Legal & Architectural Compliance  

---

## 1. Compliance Matrix

| Component / Library | Version Evaluated | License Type | Commercial Compatibility | Permitted Usage in JNN | Risk / Restrictions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Three.js** | r170+ | **MIT** | **Approved** | Primary 3D WebGL/WebGPU graphics core | None. Standard attribution required. |
| **React & React-DOM** | 19.x | **MIT** | **Approved** | Frontend UI framework | None. |
| **Vite** | 6.x | **MIT** | **Approved** | Frontend bundler & dev server | None. Build-time tool only. |
| **Lucide React** | 0.460+ | **ISC** | **Approved** | UI vector iconography | Permissive. |
| **That Open Engine (`@thatopen/components`)** | 2.x | **MPL-2.0** | **Approved (Modular)** | Client-side IFC Fragment parsing & loading | File-level copyleft. Modifications to library files must be made available; does NOT infect JNN proprietary core. |
| **web-ifc** | 0.0.60+ | **MPL-2.0** | **Approved (Modular)** | WebAssembly IFC C++ parser | File-level copyleft. |
| **xeokit-bim-viewer / xeokit SDK** | 2.6.x | **AGPLv3** | **REJECTED for Proprietary Core** | **Do NOT bundle in JNN code** | **High Viral Risk:** AGPLv3 forces entire software linking to it to be open-sourced. Rejected unless separate commercial license purchased. |
| **IfcOpenShell (Python)** | 0.8.x | **LGPL-3.0-or-later** | **Approved (Process Isolation)** | Background worker microservice (`Jnn.IfcWorker`) | Must run in separate CLI/microservice process communicating over standard IPC/REST; no static linking. |
| **Autodesk Platform Services (APS)** | Cloud API | **Autodesk Proprietary Terms** | **Approved (Cloud Bridge)** | Cloud conversion adapter for RVT / NWC / NWD | Requires developer account and client-side access token. Pay-per-job conversion fees. |
| **Autodesk Revit SDK (2024-2027)** | Official SDK | **Autodesk API License** | **Approved (Add-In Bridge)** | Out-of-process Revit exporter add-in | Must be isolated in version-specific bridge assemblies (`integrations/Revit`). |
| **Microsoft.Web.WebView2** | 1.0.x | **Microsoft Software License** | **Approved** | WPF Desktop shell embedding React UI | Redistributable with Windows Edge Evergreen runtime. |
| **PostgreSQL & EF Core** | 16 / .NET 10 | **PostgreSQL License / MIT** | **Approved** | Database & ORM | Permissive. |

---

## 2. Compliance Guidelines for Developers

1. **No AGPL Code in Codebase:** No code from xeokit SDK or any AGPLv3 repository may be copied, modified, or statically linked into `Jnn.Desktop`, `Jnn.Web`, `Jnn.Api`, or `native/Jnn.Geometry.Core`.
2. **MPL-2.0 Isolation:** Keep all `@thatopen/*` dependencies in their own modular adapter wrapper (`src/adapters/IfcFragmentAdapter.ts`).
3. **IfcOpenShell Process Isolation:** Python IfcOpenShell scripts must run as an independent background worker (`services/Jnn.IfcWorker`). Output geometry must be serialized into versioned JNN Geometry Cache binary files or JSON schemas before passing to C# or C++ modules.

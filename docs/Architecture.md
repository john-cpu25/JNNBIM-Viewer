# JNN BIM Viewer — System Architecture
**Document ID:** JNN-DOC-ARCH-001  
**Version:** 1.0.0  
**Target Architecture:** Multi-Layered Hybrid Desktop + Web Platform  

---

## 1. High-Level Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                            PRESENTATION TIER                                      |
|                                                                                   |
|  [ WPF Desktop Shell (C# .NET 10) ]       [ Web Browser (Chrome/Edge/Firefox) ]   |
|         |                                                      |                  |
|         +-----------------------+------------------------------+                  |
|                                 |                                                 |
|                                 v                                                 |
|                 [ Jnn.Web (React 19 + TypeScript + Vite) ]                        |
|   +---------------------------------------------------------------------------+   |
|   | - Application Shell & Navigation        - Clash Detection Workspace       |   |
|   | - 5-Tier Model Explorer                 - Quantity Takeoff (QTO) Engine   |   |
|   | - Properties & IFC Metadata Inspector   - Online Reports & BCF Issues     |   |
|   | - Multi-Plane Sectioning Tools          - Model Ingestion Wizard          |   |
|   |                                                                           |   |
|   |                        [ ViewerAdapter Interface ]                        |   |
|   |                                     |                                     |   |
|   |          +--------------------------+--------------------------+          |   |
|   |          |                          |                          |          |   |
|   |          v                          v                          v          |   |
|   |   [ ThreeJsAdapter ]      [ ThatOpenIfcAdapter ]     [ AutodeskApsAdapter ]|  |
|   |   (Native WebGL2/WebGPU)   (Wasm web-ifc Fragments)    (Cloud RVT/NWD)    |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------+-----------------------------------------+
                                          | REST API / WebSockets / WebView2 IPC
                                          v
+-----------------------------------------------------------------------------------+
|                              SERVICES & BACKEND TIER                              |
|                                                                                   |
|  [ Jnn.Api (ASP.NET Core .NET 10 LTS) ]                                           |
|   - Project & Revision Registry                                                   |
|   - Clash Metadata & Lifecycle Store                                              |
|   - Quantity Rules & Validation Engine                                            |
|   - BCF 2.1/3.0 & Issue Management Service                                        |
|   - Security, Token Auth & Storage Provider                                       |
|                                                                                   |
|  [ Background Processing Workers ]                                                |
|   - Jnn.Worker (.NET 10 background queue for spatial indexing & reporting)       |
|   - Jnn.IfcWorker (Python 3.12 + IfcOpenShell metadata extraction)                |
+-----------------------------------------+-----------------------------------------+
                                          | P/Invoke / Native C API
                                          v
+-----------------------------------------------------------------------------------+
|                           NATIVE GEOMETRY ENGINE TIER                             |
|                                                                                   |
|  [ native/Jnn.Geometry.Core (C++20 Native DLL) ]                                  |
|   - AABB (Axis-Aligned Bounding Box) calculation                                  |
|   - BVH (Bounding Volume Hierarchy) spatial indexing                              |
|   - Broad-Phase Clash Collision Detection                                         |
|   - Triangle-to-Triangle Narrow-Phase Intersection                                |
|   - Geometric Clearance & Proximity Queries                                       |
|   - Section-Plane Polygon Generation & Mesh Slicing                               |
+-----------------------------------------------------------------------------------+
```

---

## 2. Shared Data Contracts

All format adapters (`IFC`, `Revit RVT`, `Navisworks NWC/NWD`) translate their proprietary data models into the canonical **JNN BIM Schema**:
- `ModelId` (UUID)
- `ModelRevisionId` (UUID)
- `SourceFormat` (Enum: `IFC2X3`, `IFC4`, `RVT2024`, `RVT2025`, `RVT2026`, `RVT2027`, `NWD`)
- `SourceElementId` (String: e.g. `245891`)
- `GlobalId` (String: IFC GUID if available)
- `Category` (String: e.g. `IfcBeam`, `OST_StructuralFraming`)
- `Discipline` (Enum: `Structural`, `Architectural`, `Mechanical`, `Electrical`, `Plumbing`)
- `Storey` (String: e.g. `Level 02`)
- `Material` (String: e.g. `Concrete - C30/37`)
- `Dimensions` (Object: `length`, `width`, `height`, `area`, `volume`)
- `Transform` (Matrix 4x4 array of 16 floats)
- `Properties` (Dictionary of PropertySets: `name -> { key: value }`)
- `Quantities` (Dictionary: NetVolume, GrossVolume, FormworkArea, Weight)
- `GeometryStatus` (Enum: `Cached`, `PendingTessellation`, `Corrupted`)

---

## 3. Desktop Shell Integration via WebView2

The desktop application `Jnn.Desktop` uses Microsoft WebView2 to render the high-performance React web interface:
1. **Bidirectional IPC Messaging:**
   - C# sends: `LoadLocalFile(path)`, `WindowControl(minimize|maximize)`, `NativeClashResult(data)`.
   - React sends: `RequestOpenFileDialog()`, `SaveExportFile(blob, filename)`, `ExecuteNativeClash(meshA, meshB)`.
2. **Schema-Enforced IPC Bridge:** Messages conform to `BridgeMessage<T>` with type-safe action identifiers.
3. **Local File Virtual Host:** WebView2 maps local cached model geometries to a virtual domain `http://jnn.local/cache/...` eliminating CORS issues.

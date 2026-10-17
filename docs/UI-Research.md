# JNN BIM Viewer — UI/UX Research Report
**Document ID:** JNN-DOC-UI-001  
**Author:** JNN BIM Product & UX Engineering Core Team  
**Date:** October 2026  
**Status:** Approved for Architecture & Implementation  

---

## 1. Executive Summary

To design and build **JNN BIM Viewer** as an industry-grade, hybrid Desktop + Web BIM software tailored for structural engineers, BIM coordinators, modelers, and quantity surveyors, we conducted in-depth technical and UX research into six market-leading BIM viewers and coordination platforms:
1. **Autodesk Viewer / APS Viewer SDK** (Web-first universal cloud viewer)
2. **Autodesk Navisworks Manage** (Desktop gold-standard for multi-trade clash detection)
3. **Trimble Connect 3D Viewer** (High-efficiency multi-model coordination & field tool)
4. **Solibri Office** (Rule-based model checking, QA/QC, and Information Takeoff)
5. **xeokit BIM Viewer** (Open-source browser-based WebGL BIM visualizer)
6. **That Open Engine / Open BIM Components** (Modern Three.js-based OpenBIM IFC modular framework)

This report documents our empirical findings, comparative matrix, structural workflows, adopted patterns, and explicit anti-patterns that JNN will reject.

---

## 2. Comparative Analysis Matrix

| Feature / Dimension | Autodesk Viewer (APS) | Autodesk Navisworks Manage | Trimble Connect (Win/Web) | Solibri Office | xeokit BIM Viewer | That Open Engine | **JNN BIM Viewer Target** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Platform** | Web (Three.js fork) | Desktop (C++ / Win32 / WPF) | Hybrid (Win Desktop C++ + WebGL Web) | Desktop (Java / C++) | Web (WebGL2 / xeokit SDK) | Web (Three.js / WebAssembly) | **Hybrid: .NET 10 WPF + React / Three.js** |
| **Model Formats Supported** | RVT, NWC, IFC, DWG, STEP, 60+ CAD | NWD, NWC, NWF, RVT, IFC, DWF | TRB, IFC, RVT, DWG, SKP, Point Cloud | IFC, DWG, PDF | XKT (native binary), glTF, IFC (via converter) | IFC (via web-ifc), Fragments, glTF | **IFC (Native), RVT/NWC (APS/Native Adapter)** |
| **Workspace Model** | Single Viewport + Overlays | Modular Dockable Windows | View-centric + Side Drawers | Strict Workspace Tabs (Model, Checking, ITO) | Single Canvas + Accordion Panels | Modular Components Canvas | **Task-focused Workspaces (Model, Section, Clash, QTO, Report)** |
| **Model Tree Organization** | Model → Category → Family → Element | File → Layer → Category → Geometry | Folder → Model → Class → Storey | Containment (Site → Building → Storey → Element) | Storey Tree, Type Tree, Custom Groups | Spatial Structure Tree, Fragments Groups | **Unified 5-tier Hierarchy: Model → Discipline → Level → Category → Element** |
| **3D Navigation Gizmo** | Integrated ViewCube | Standard Autodesk ViewCube | Interactive Navigation Cube + Orientation Bar | Navigation Cube + Compass | Simple Compass / Axis Gizmo | Custom Three.js Gizmo | **Interactive ViewCube + Camera Preset Ribbon** |
| **Section & Clipping** | Plane (X,Y,Z), Section Box with Gizmo | Cut Planes (6 planes), Section Box | Section Planes (Click surface), Clip Box | 6 Cutting Planes with interactive handles | Single/Multi Section Planes | Clipping Planes + Volume Clipper | **Section Box + Triple Orthogonal Planes + Flip/Offset** |
| **Clash Detection Engine** | Cloud Model Coordination (BIM 360) | Native Clash Detective (Hard, Clearance, Dup) | Extension-based Clash Checking | Rule-based Checking (Heuristic & Clash) | None (Requires custom code) | Spatial Query (Experimental bounding) | **Dual-Phase: C++20 Native Broad-Phase (BVH) + Viewport Interactive A/B** |
| **Quantity Takeoff (QTO)** | Limited (Property inspect) | Navisworks Quantification Workbook | Property table & Model comparison | Advanced Information Takeoff (ITO) Grid | None out-of-the-box | Dimensions & Volume Query | **Structural QTO: Net Concrete Volume, Formwork Area, Element Aggregation** |
| **Licensing Model** | Proprietary SaaS (APS Cloud Consumption) | Commercial Desktop Perpetual/Subscription | Commercial SaaS (Trimble Business) | Commercial Enterprise Proprietary | **AGPLv3 (Viral Copyleft)** or Commercial Fee | **Mozilla Public License 2.0 (MPL-2.0)** | **Proprietary Commercial Core + Permissive Open Modules** |

---

## 3. Deep-Dive Research by Reference Source

### Reference A — Autodesk Viewer / APS Viewer SDK
- **Official URLs:**
  - Help: [https://help.autodesk.com/cloudhelp/ENU/ADSKVIEWER-Help/files/ADSKVIEWER_Help_AutodeskViewerTools_html.html](https://help.autodesk.com/cloudhelp/ENU/ADSKVIEWER-Help/files/ADSKVIEWER_Help_AutodeskViewerTools_html.html)
  - SDK: [https://aps.autodesk.com/developer/overview/viewer-sdk](https://aps.autodesk.com/developer/overview/viewer-sdk)
- **Key Layout Patterns:**
  - Floating bottom toolbar docking common navigation (Orbit, Pan, Zoom, Fit), visibility toggles (Model Browser, Properties), and analysis tools (Measure, Section, Explode, Settings).
  - Model Browser: Clean tree with search bar at top, eye icon for visibility, right-click context menu (Isolate, Hide, Show All, Focus).
  - Properties Inspector: Grouped key-value pairs (Identity Data, Dimensions, Structural, Phasing). Fast selection binding.
- **UX Strengths:**
  - Exceptional canvas responsiveness; viewport is never obscured by unnecessary containers.
  - Section Box with 6 planar drag handles and axis gizmo is highly intuitive.
  - Ambient occlusion and edge line rendering make architectural models crisp and legible.
- **UX Limitations:**
  - Bottom toolbar can become overcrowded on small displays.
  - Multi-model federated coordination requires heavy cloud translation pipeline.
- **Adoption for JNN:**
  - Adopt the floating contextual toolbar design with grouped popovers.
  - Adopt the property inspector grouping scheme (General, Structural Geometry, Materials, IFC Parameters).
  - Adopt right-click context menu shortcuts (Isolate, Hide, Focus, Inquire Quantity, Add to Clash Test).

### Reference B — Autodesk Navisworks Manage (Clash Detective)
- **Official URLs:**
  - Documentation: [https://help.autodesk.com/cloudhelp/2027/ENU/Navisworks-Clash-Detective/files/GUID-FCC9E5E1-2717-48D2-8DBE-2055CF2DC61E.htm](https://help.autodesk.com/cloudhelp/2027/ENU/Navisworks-Clash-Detective/files/GUID-FCC9E5E1-2717-48D2-8DBE-2055CF2DC61E.htm)
  - Article: [https://www.autodesk.com/support/technical/article/caas/tsarticles/ts/4T3o6YMrs32IPvWzn4VOEP.html](https://www.autodesk.com/support/technical/article/caas/tsarticles/ts/4T3o6YMrs32IPvWzn4VOEP.html)
- **Key Layout Patterns:**
  - Clash Detective Tabbed Architecture: **Tests**, **Rules**, **Select** (Tree A vs Tree B), **Results**, **Report**.
  - Selection A vs Selection B: Tree selection allowing granular discipline checking (e.g., Structural Framing vs Mechanical Ducts) with tolerance input (e.g., 0.010 m).
  - Results Window: Multi-column table with Status (`New`, `Active`, `Reviewed`, `Approved`, `Resolved`), Severity, Distance/Overlap, Grid Location, Assigned To, Item 1 / Item 2 metadata.
  - Dynamic Viewport State: Selecting a clash row smoothly auto-focuses camera to clash bounding box, isolates or dims other model elements (`Dim Other` / `Hide Other`), and highlights Item A in Red and Item B in Green.
  - Grouping: Ability to group clashes into folders by Grid line, Level, or Category.
- **UX Strengths:**
  - Unmatched efficiency for handling 1,000+ clashes without viewport lag.
  - High auditability: status tracking, timestamping, user assignment.
- **UX Limitations:**
  - Legacy Win32 interface is visually cluttered, dense with tiny 16x16 pixel icons, and lacks responsive flow.
  - High barrier to entry for novice reviewers.
- **Adoption for JNN:**
  - Direct adoption of Navisworks 5-state lifecycle: `New` (Yellow/Blue), `Active` (Red), `Reviewed` (Purple), `Approved` (Green), `Resolved` (Slate/Check).
  - Adopt the Split A/B Selection methodology for clash configuration.
  - Adopt the auto-focus and dual-element contrasting highlight (`#EF4444` for Element A, `#10B981` for Element B) with semi-transparent ghosting for surrounding context (`opacity: 0.15`).

### Reference C — Trimble Connect 3D Viewer
- **Official URLs:**
  - Reference Guide: [https://help.trimble.com/doc/trimble-connect/trimble-connect/connect-for-windows/working-in-3d/3d-viewer-reference-guide](https://help.trimble.com/doc/trimble-connect/trimble-connect/connect-for-windows/working-in-3d/3d-viewer-reference-guide)
  - Clipping Planes: [https://help.trimble.com/doc/trimble-connect/trimble-connect/connect-for-browsers-3d-viewer/clipping-planes/clipping-plane-tools](https://help.trimble.com/doc/trimble-connect/trimble-connect/connect-for-browsers-3d-viewer/clipping-planes/clipping-plane-tools)
- **Key Layout Patterns:**
  - Minimalist top-left / left toolbar for camera modes, selection modes, and measurements.
  - Bottom strip for Saved Views & Viewpoint thumbnails with one-click restore of camera, section planes, and element visibility states.
  - Direct face-snapping clipping tool: click any planar geometry to align a section cut immediately.
  - Integrated ToDo / BCF topics panel linked to active model state.
- **UX Strengths:**
  - Extremely fast camera transitions and clean engineering aesthetic.
  - Saved views strip provides instant visual storyboard navigation for meetings and coordination reviews.
- **UX Limitations:**
  - Table data management (properties and quantities) is secondary and tucked away into narrow side-panels.
- **Adoption for JNN:**
  - Adopt the Saved Viewpoints strip with thumbnail preview, camera position, and active section planes.
  - Adopt face-oriented clipping plane creation and instant reverse/flip toggle.

### Reference D — Solibri Office
- **Official Reference Summary:**
  - Note on accessibility: Direct scraping of Solibri Zendesk helpdesk returned HTTP 403 Forbidden (bot protection); information verified through public Solibri technical manuals and standard BIM QA/QC documentation.
- **Key Layout Patterns:**
  - Dedicated Workflow Workspaces (Layouts):
    1. **Model Layout**: Raw navigation, Model Tree, Info View.
    2. **Checking Layout**: Ruleset manager, Results table grouped by severity, 3D issue focus.
    3. **Communication Layout**: Presentation slides, BCF issue cards, comments, viewpoint management.
    4. **Information Takeoff (ITO) Layout**: Spreadsheet grid with multi-level grouping (Storey → Component → Material), aggregate formulas (Count, Total Area, Total Volume), real-time bidirectional selection sync with 3D model.
- **UX Strengths:**
  - Clear cognitive separation between inspecting a model, checking rules, extracting quantities, and communicating issues.
  - The ITO spreadsheet is the gold standard for structural quantity validation.
- **UX Limitations:**
  - Rigid desktop layouts can feel heavyweight and clunky when only quick viewing is needed.
- **Adoption for JNN:**
  - Adopt the top workspace switcher: `Model`, `Section`, `Clash`, `Quantity`, `Reports`.
  - Adopt Solibri's Information Takeoff architecture: grouping by Level, Category, Type, and Material with aggregated totals and color-coded verification status.

### Reference E — xeokit BIM Viewer
- **Official URLs:**
  - Repository: [https://github.com/xeokit/xeokit-bim-viewer](https://github.com/xeokit/xeokit-bim-viewer)
  - Documentation: [https://xeokit.github.io/xeokit-bim-viewer/docs/](https://xeokit.github.io/xeokit-bim-viewer/docs/)
- **Key Layout Patterns:**
  - Web-first canvas with left collapsible sidebar featuring tabs for: Models, Objects (Storey Tree / Class Tree), Viewpoints, and Measurements.
  - Efficient binary XKT format for high-speed geometry streaming.
  - Integrated 2D Storey plan view synchronized with 3D camera position.
- **Licensing & Legal Constraints:**
  - **AGPLv3 License:** xeokit SDK is strictly licensed under AGPLv3. Integrating xeokit directly into a commercial proprietary desktop/cloud solution triggers viral open-source requirements or requires purchasing an expensive commercial license from Creoox AG.
- **Conclusion for JNN:**
  - **Do NOT embed xeokit SDK directly into JNN proprietary core.** Learn from its UI layout and binary stream decomposition, but build our rendering pipeline upon Three.js and That Open Engine.

### Reference F — That Open Engine (Open BIM Components)
- **Official URLs:**
  - Repository: [https://github.com/ThatOpen/engine_components](https://github.com/ThatOpen/engine_components)
  - Web-IFC: [https://github.com/ThatOpen/engine_web-ifc](https://github.com/ThatOpen/engine_web-ifc)
  - Core Worlds: [https://github.com/ThatOpen/engine_components/blob/main/packages/core/src/core/Worlds/example.ts](https://github.com/ThatOpen/engine_components/blob/main/packages/core/src/core/Worlds/example.ts)
- **Key Layout Patterns & Architecture:**
  - Built directly on Three.js!
  - High performance: parses IFC files into WebAssembly memory via `web-ifc` and renders instanced meshes called "Fragments".
  - Modular UI tools: Clipper (section planes), SimpleDimensions, SpatialTree, Outliner, PostproductionRenderer.
- **Licensing:**
  - **Mozilla Public License 2.0 (MPL-2.0):** Permissive file-level copyleft. Extremely suitable for hybrid commercial products. JNN can use and extend Open BIM Components without compromising proprietary backend or C++ geometry core code.
- **Adoption for JNN:**
  - Adopt Three.js as the primary WebGL/WebGPU viewport renderer.
  - Interface Jnn.Web with `@thatopen/components` and `web-ifc` for client-side IFC parsing.
  - Implement a pluggable `ViewerAdapter` abstraction layer so Autodesk APS, Three.js native, and IFC Fragments can be swapped seamlessly.

---

## 4. Synthesis: Patterns Adopted vs Rejected

### Patterns Adopted for JNN BIM Viewer
1. **Top Task-Oriented Workspaces (Solibri pattern):** Clean switcher between `Model`, `Section`, `Clash`, `Quantity`, and `Reports` to keep toolbars contextual and eliminate cognitive clutter.
2. **5-Tier Model Hierarchy (JNN Standard):** `Model` → `Discipline` (Structural / Architectural / MEP) → `Building Level` → `Category` (Columns, Beams, Slabs, Walls, Footings) → `Element ID`.
3. **Dual Selection Clash Workflow (Navisworks pattern):** Selection A vs Selection B with millimeter tolerance, 5-state lifecycle (`New`, `Active`, `Reviewed`, `Approved`, `Resolved`), and automatic camera focus with high-contrast dual highlight.
4. **Structural Information Takeoff Grid (Solibri pattern):** Grouping by Level / Category / Material, displaying gross/net volume, surface area, mark, calculation basis, and instant row-to-element 3D highlighting.
5. **Interactive Section Plane & Section Box (Autodesk/Trimble pattern):** Instant orthographic plane cuts (X, Y, Z), flip normals, and offset controls.
6. **Dual Theme Token Engine:** High-contrast Dark Engineering Slate (`#0B1120`, `#1E293B`) and Clean Architectural Light (`#FFFFFF`, `#F8FAFC`) with independent 3D viewport canvas background presets.

### Patterns Explicitly Rejected
1. **Cramped Win32 MDI / Floating Dialog Sprawl (Navisworks legacy):** Overlapping floating modal tool windows that cover the 3D viewport will not be used. All panels are dockable, resizable, and collapsible.
2. **Single Overloaded Bottom Toolbar (Autodesk Viewer limitation):** Avoid packing 25+ tool icons into a single horizontal strip.
3. **Viral Copyleft Dependencies (xeokit AGPLv3):** Will not use AGPL-licensed libraries to preserve intellectual property of JNN proprietary algorithms.
4. **Fictitious / Synthetic Bounding Box Quantities:** Volume calculation must explicitly distinguish between native IFC/Revit parameters, exact solid geometry integrals, and approximate mesh tessellations. Never present an AABB box volume as concrete volume!

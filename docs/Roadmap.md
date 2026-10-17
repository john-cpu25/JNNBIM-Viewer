# JNN BIM Viewer — Product & Technical Roadmap
**Document ID:** JNN-DOC-ROADMAP-001  
**Version:** 1.0.0  
**Planning Horizon:** 8 Engineering Phases  

---

## Phase 1: UI Shell, Design Tokens & Core Navigation
- **Scope:**
  - Build the React 19 + TypeScript + Vite frontend shell (`apps/Jnn.Web`).
  - Implement full design token system (CSS variables, light/dark themes, viewport background presets).
  - Implement top application bar, workspace ribbon switcher, and bottom status bar.
  - Implement responsive layouts for 1920×1080, 1600×900, 1440×900, and 1366×768.
- **Dependencies:** Node.js, Vite, Tailwind/CSS variables, Lucide React.
- **Acceptance Criteria:**
  - Zero compilation errors.
  - Seamless theme toggle between Dark Slate and Light Architectural themes.
  - Smooth collapsible left and right drawers without viewport flickering.

---

## Phase 2: High-Performance 3D Viewer Engine & Navigation
- **Scope:**
  - Implement Three.js WebGL2 viewport with orbit controls, pan, zoom, and fit-to-view.
  - Add interactive ViewCube orientation gizmo with camera presets (Top, Front, Left, Right, Iso).
  - Implement element raycasting for hover and selection highlighting.
  - Render a realistic multi-storey structural BIM building model (columns, beams, slabs, foundations, shear walls).
  - Implement camera projection toggle (Perspective vs Orthographic).
- **Dependencies:** Three.js.
- **Acceptance Criteria:**
  - Solid 60 FPS viewport rendering.
  - Click on any 3D element highlights geometry and emits selection event to application state.

---

## Phase 3: Model Explorer & Properties Inspector
- **Scope:**
  - 5-Tier hierarchical Model Explorer tree (`Model` → `Discipline` → `Storey` → `Category` → `Element`).
  - Search filtering by element mark, category, or GUID.
  - Visibility toggles (eye icons), multi-element isolate, hide selection, and show all.
  - Right panel Properties Inspector with collapsible groups (Identity, Dimensions, Structural, Materials, IFC Property Sets).
- **Dependencies:** JNN Data Model contracts.
- **Acceptance Criteria:**
  - Bidirectional synchronization: selecting an element in the 3D viewport selects it in the tree and displays properties in the inspector; clicking a node in the tree highlights it in 3D.

---

## Phase 4: Sectioning, Measurement & Saved Viewpoints
- **Scope:**
  - Interactive clipping planes (X, Y, Z orthogonal cut planes + Section Box).
  - Dynamic offset slider and normal flip control.
  - Direct face snapping for section alignment.
  - Saved Viewpoints strip with thumbnail generation, camera state, and clipping configuration.
- **Dependencies:** Three.js clipping planes API.
- **Acceptance Criteria:**
  - Smooth planar cuts through structural geometry without scene re-tessellation.
  - Saving and restoring a viewpoint accurately recovers camera and section state.

---

## Phase 5: Clash Detection Workspace (Navisworks Pattern)
- **Scope:**
  - Selection Set A vs Selection Set B selection interface.
  - Tolerance configuration (mm) and clash types (Hard Clash, Clearance).
  - Multi-column Clash Table with 5-state lifecycle (`New`, `Active`, `Reviewed`, `Approved`, `Resolved`).
  - Auto-focus camera on clash selection with dual-element contrasting highlight (Item A: Red, Item B: Cyan) and 15% opacity ghosting for surroundings.
  - Status updates, reviewer assignment, and clash report generation.
- **Dependencies:** C++20 `Jnn.Geometry.Core` for broad phase; TypeScript client state for coordination UI.
- **Acceptance Criteria:**
  - Clicking any clash row instantly navigates to the intersection in 3D and highlights both conflicting members clearly.

---

## Phase 6: Structural Quantity Takeoff (Solibri Pattern)
- **Scope:**
  - Structural takeoff table for Concrete and Formwork.
  - Dynamic multi-level grouping (By Storey, By Category, By Type, By Material).
  - Accurate differentiation between Native IFC Quantities, Solid Calculus, and Mesh Approximations.
  - Summary aggregation row (Total Volume m³, Total Formwork Area m², Element Count).
  - CSV and Excel export functionality.
- **Dependencies:** Jnn.Quantity module.
- **Acceptance Criteria:**
  - Instant grouping recalculation without UI lockup.
  - One-click export to CSV / Excel.

---

## Phase 7: Online Reports, BCF & Model Ingestion Wizard
- **Scope:**
  - BCF 2.1/3.0 compliant issue management with comments, audit history, and viewpoint snapshots.
  - Executive coordination report generation (PDF preview).
  - Step-by-step Model Ingestion Wizard with format detection (.ifc, .rvt, .nwc, .nwd), progress stage pipeline, and validation diagnostics.
- **Dependencies:** Jnn.Reporting, jsPDF / html2canvas.
- **Acceptance Criteria:**
  - Import wizard tracks stages with realistic diagnostic logs and validation warnings.
  - Issues can be created from active 3D camera state and exported as BCF.

---

## Phase 8: Desktop Shell (WPF .NET 10), Native Geometry Core & Production Polish
- **Scope:**
  - Build and package `Jnn.Desktop` using C# 14 / .NET 10 LTS with WebView2.
  - Implement C++20 `Jnn.Geometry.Core` (AABB, BVH, broad-phase clash) with C API export.
  - Connect Python IfcOpenShell worker adapter.
  - Performance optimization (LOD, frustum culling, memory garbage collection).
  - Accessibility audit (ARIA labels, focus outlines, keyboard shortcuts).
- **Dependencies:** .NET 10 SDK, CMake, MSVC/Clang, Python 3.12.
- **Acceptance Criteria:**
  - Desktop executable launches and embeds the web viewer with zero console errors.
  - Native geometry benchmarks pass unit testing.

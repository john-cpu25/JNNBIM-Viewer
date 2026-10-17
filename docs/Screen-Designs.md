# JNN BIM Viewer — Screen Designs & Architecture
**Document ID:** JNN-DOC-UI-003  
**Status:** Canonical Reference  

This document details the layout hierarchy, interactive components, responsive behaviors, and state machines for all primary screens in JNN BIM Viewer.

---

## Screen 1 — Project Home
- **Goal:** Fast project launcher, recent model files, model revision tracking, pipeline processing status, and quick import.
- **Header:** JNN Logo, Current Organization (`JNN Structural Engineering`), Project Switcher dropdown, User Profile, Help/Docs link.
- **Primary Grid:**
  - **Quick Action Bar:** `+ New Project`, `Import BIM Model (IFC/RVT/NWC)`, `Open Local File`.
  - **Active Projects Carousel / Cards:** Project Name, Active Revision (`Rev 2.4`), Element Count, Open Issues count, Last Modified date.
  - **Recent Models Table:**
    - Columns: Model Name, File Format Badge (`IFC4`, `RVT 2025`, `NWD`), Size, Discipline, Ingestion Status (`Ready`, `Processing 78%`, `Cache Stale`), Action (`Open in Viewer`, `Manage Revisions`).
  - **Coordination Activity Feed:** Recent clashes resolved, new BCF comments, report exports.

---

## Screen 2 — Main BIM Viewer (Core Engine View)

### A. Application Header (Top Bar - 48px)
- **Left:** JNN Viewer Brand Icon + Wordmark (`JNN BIM Viewer`), Project Selector (`Metropole Tower B`), Model Selector (`Structural_Rev04.ifc`).
- **Center:** Quick View Stats (`Storeys: 12`, `Total Elements: 4,812`, `Sync: Live`).
- **Right:** Undo/Redo buttons, Theme Toggle (Light/Dark), Viewport Background Color Picker, Settings gear, User Avatar.

### B. Workspace Ribbon (Sub-Header - 40px)
- Segmented workspace buttons with badge counts:
  - `Model` (Default 3D Navigation)
  - `Section` (Cut planes & Section box)
  - `Clash Detection` (Active: `4 Unresolved`)
  - `Quantity Takeoff` (QTO Concrete & Formwork)
  - `Reports & BCF` (Issues: `6 Open`)
  - `Import / Ingestion` (Wizard)

### C. Left Panel — Model Explorer (Resizable 260px - 440px)
- **Top Search & Filter Bar:** Instant fuzzy search by Element Name, Mark, or GUID (`e.g., C600x600`, `Beam-B202`).
- **Discipline Filter Tabs:** `All`, `Structural`, `Architectural`, `MEP`.
- **Level / Storey Selector Dropdown:** Fast isolation of single floors (`Foundation`, `Level 01`, `Level 02`, `Roof`).
- **Hierarchical Tree View:**
  - 5-Tier nesting: `Model` → `Discipline` → `Storey` → `Category` → `Element`.
  - Controls per node: Checkbox (Select all children), Eye Icon (Visibility Toggle), Count Badge (e.g. `Beams (142)`).
  - Hover highlights corresponding 3D elements in viewport.
- **Bottom Tree Actions:** `Show All`, `Isolate Selection`, `Invert Selection`.

### D. Center Viewport — 3D Canvas
- **Rendering Canvas:** WebGL2 / WebGPU viewport with high performance Three.js scene.
- **Top-Right Navigation Gizmo (ViewCube):** Interactive orientation cube (`Top`, `Front`, `Right`, `Iso`) with rotation rings and compass heading.
- **Top-Left Quick Controls:**
  - Camera Mode toggle: Perspective (`P`) vs Orthographic (`O`).
  - View presets dropdown: `Isometric`, `Top Floorplan`, `Front Elevation`, `Left Section`.
  - Rendering mode: `Shaded Material`, `Monochrome Clay`, `X-Ray Ghost`, `Wireframe`.
- **Floating Bottom Toolbar (Docked Center):**
  - Group 1 (Navigation): Select Pointer, Orbit, Pan, Zoom Window, Fit to View (`F`).
  - Group 2 (Visibility): Hide Selected (`H`), Isolate Selected (`I`), Show All (`A`), Ghost Unselected (`G`).
  - Group 3 (Analysis): Section Plane toggle (`X`), Measure Ruler (`M`), Clash Review, Quantity Probe.
  - Group 4 (Output): Save Viewpoint snapshot, Export Screenshot PNG, Fullscreen (`F11`).

### E. Right Panel — Properties Inspector (Resizable 280px - 480px)
- **Header:** Selected Element Name (`B-400x700-C30`), IFC Class (`IfcBeam`), GlobalId with 1-click Copy button.
- **Tabs:** `Properties`, `Quantities`, `Issues`.
- **Collapsible Property Groups:**
  1. **Identity & Location:** Source Model, Discipline, Level, Grid Reference (`Axis 3-C`), Phase.
  2. **Structural Geometry:** Width `b` (400 mm), Depth `h` (700 mm), Clear Span `L` (6,200 mm), Slenderness Ratio.
  3. **Material & Specifications:** Material Name (`Concrete C30/37`), Characteristic Strength `fck` (30 MPa), Rebar Grade (`CB400-V`).
  4. **IFC Property Sets:** `Pset_BeamCommon`, `Pset_ConcreteElementGeneral`.
  5. **Native CAD Parameters:** Revit Family / Type parameters if populated.

### F. Bottom Status Bar (28px)
- Left: System State (`Ready`), Active Engine (`Three.js / WebGL2`), Unit System (`Metric (mm, m³)`).
- Center: Active Selection (`1 element selected: C600x600_L2_Col14`), Bounding Coordinates `(X: 14.20m, Y: 28.50m, Z: 6.80m)`.
- Right: Mesh Triangles count (`84,200 tris`), Viewport FPS (`60.0 fps`), Background Tasks (`Worker: Idle`).

---

## Screen 3 — Section Workspace
- **Core Intent:** High precision cross-sectional analysis for structural inspection and clear spans.
- **Section Controls Bar:**
  - Mode Switch: `Section Box` vs `Single Plane` vs `Triple Orthogonal`.
  - Active Plane Orientation: `X-Normal (East-West)`, `Y-Normal (North-South)`, `Z-Normal (Horizontal Slab Cut)`.
  - Offset Slider with numeric millimeter input (e.g. `Offset: +2,450 mm`).
  - `Flip Normal` button (inverts cut direction).
  - `Align to Selected Face` button (snaps cutting plane to clicked element plane).
  - Section Box boundary handles (min/max X, Y, Z extents).
- **Saved Sections Library:** List of pre-configured sections (`Foundation Mat Section`, `Level 02 Typical Floor Beam Cut`, `Core Wall Shear Section`).

---

## Screen 4 — Clash Detection Workspace
- **Core Intent:** Rigorous coordination workflow inspired by Navisworks Manage & Solibri.
- **Top Coordination Toolbar:** `+ New Clash Test`, `Run Test`, `Re-run Stale Tests`, `Export Clash Report (PDF/Excel)`, `Export BCF Package`.
- **Test Configuration Drawer:**
  - Active Test selector: `Test 01: Structural Framing vs Mechanical Ducts`.
  - Selection Set A: Tree picker (`Structural Beams & Slabs`).
  - Selection Set B: Tree picker (`HVAC Ducts & Piping`).
  - Clash Type: `Hard Clash`, `Clearance Violation` (Tolerance: `15 mm`).
- **Clash Results Table:**
  - Columns:
    - `ID` (`CL-001`, `CL-002`)
    - `Status Badge` (`New` Blue, `Active` Red, `Reviewed` Purple, `Approved` Green, `Resolved` Gray)
    - `Severity` (`Critical`, `Major`, `Minor`)
    - `Item A` (`Girder B500x800 - Axis 4`)
    - `Item B` (`Supply Air Duct 600x400`)
    - `Overlap / Distance` (`42.5 mm overlap`)
    - `Level` (`Level 03`)
    - `Grid Location` (`Grid 4-D`)
    - `Assigned To` (`Nguyen Van A (MEP Lead)`)
    - `Due Date` (`2026-10-25`)
- **Row Interaction:**
  - Single click smoothly flies the 3D camera to the clash focus point.
  - Automatically isolates Item A (tinted Red `#EF4444`) and Item B (tinted Cyan `#06B6D4`).
  - Surrounding structural elements are ghosted at 15% opacity for spatial context.
  - Right panel opens **Clash Resolution Card**: update status dropdown, add comment, assign team member, capture viewpoint thumbnail.

---

## Screen 5 — Quantity Takeoff (QTO) Workspace
- **Core Intent:** Accurate concrete and formwork volume extraction for structural estimators.
- **Grouping Controls:** Group by `Storey / Level`, `Category`, `Component Type`, `Material Grade`.
- **Calculation Basis Indicator:** Badges distinguishing `Verified Native Solid`, `Computed Mesh Integral`, or `Bounding Box (Approx)`.
- **Takeoff Table Grid:**
  - Columns:
    - `Element Mark` (`C-500x500`, `B-300x600`, `SLAB-200`)
    - `Storey` (`Level 02`)
    - `Category` (`Structural Column`)
    - `Material` (`Concrete C35/45`)
    - `Count` (`16 pcs`)
    - `Dimensions (b x h x L)`
    - `Formwork Area (m²)`
    - `Net Concrete Volume (m³)` (Deductions for openings applied)
    - `Quantity Source` (`Native IFC Quantity Takeoff`)
    - `Verification Status` (`Verified ✓`)
- **Aggregate Summary Footer:** Total Concrete Volume (`1,248.65 m³`), Total Formwork Area (`4,820.30 m²`), Total Elements (`348 items`).
- **Actions:** Export to formatted Microsoft Excel `.xlsx` or CSV, Print Summary Report.

---

## Screen 6 — Online Reports & Issue Management (BCF)
- **Core Intent:** Collaborative issue tracking and official coordination meeting reports.
- **Issue Kanban / List View:**
  - Filter by Status (`Open`, `In Progress`, `Resolved`, `Closed`), Priority (`Critical`, `High`, `Normal`), Assignee.
  - Issue Card: Title, Thumbnail of 3D Viewpoint, Discipline tag, Due date, Comments count.
- **Issue Detail View:**
  - Full viewpoint preview with camera coordinates, clipping planes, and highlighted element IDs.
  - Click `Restore Viewpoint` to instantly load that camera angle in 3D viewport.
  - Comment audit trail with user avatars and timestamped history.
- **Report Generator:**
  - Template options: `Clash Coordination Report`, `Structural Quantity Summary`, `Model Quality Audit`.
  - Format options: PDF with embedded 3D viewpoint thumbnails, Excel spreadsheet, BCF 2.1/3.0 XML zip package.

---

## Screen 7 — Model Import & Ingestion Wizard
- **Steps:**
  1. **File Selection:** Drag-and-drop `.ifc`, `.rvt`, `.nwc`, `.nwd` files. File size and hash verification.
  2. **Format Adapter Detection:** Identifies parser requirements (Native WebAssembly `web-ifc` vs Python background worker vs Autodesk APS bridge).
  3. **Spatial & Units Configuration:** Confirm source units (millimeters / meters), coordinate system shift / origin realignment.
  4. **Processing Pipeline Tracker:**
     - Stage 1: Uploading / Local Cache Allocation
     - Stage 2: Schema & Property Set Extraction
     - Stage 3: Geometry Tessellation & Mesh Optimization
     - Stage 4: Spatial BVH Tree Generation
     - Stage 5: Ready for Viewer
  5. **Validation Diagnostics:** Reports missing property sets, unclosed polyhedra, or coordinate anomalies.

# JNN BIM Viewer — UI/UX Design Specification
**Document ID:** JNN-DOC-UI-002  
**Version:** 1.0.0  
**Target Environments:** Desktop (WPF WebView2 Windows x64) & Modern Web Browsers (Chrome, Edge, Firefox)  

---

## 1. Design Principles

1. **3D Viewport is King:** The 3D model viewport occupies maximum visual area (~70-80% screen estate). UI panels are thin, dockable, collapsible, and non-intrusive.
2. **High Information Density Without Visual Clutter:** Engineering tools require high data density (dimensions, quantities, clash matrices, coordinate points). Use compact typography (12-13px body), 28-32px row heights, and crisp borders rather than bulky marketing cards.
3. **Deterministic Feedback & Direct Manipulation:** Any action in a table or tree (clicking a row, changing a status) immediately highlights, isolates, or shifts focus in the 3D viewport without page refreshes or stutter.
4. **Zero Fictitious Data:** Clearly label calculation sources (`Native Model Property`, `Exact Solid Calculus`, `Mesh Approximation`, `Pending Verification`). If a clash is merely an AABB candidate, do not label it as an engine-verified hard collision.
5. **Aesthetic Excellence for Long Working Hours:** Curated dark slate and clean light palettes engineered to minimize eye fatigue during 8-10 hour coordination sessions. No bright saturated neon colors except for critical clash warnings.

---

## 2. Color System & Design Tokens

### 2.1 Brand & Functional Colors
```css
:root {
  /* Brand Primary - Engineering Cyan / Deep Teal */
  --jnn-primary: #0891b2;         /* Cyan 600 */
  --jnn-primary-hover: #0e7490;   /* Cyan 700 */
  --jnn-primary-active: #155e75;  /* Cyan 800 */
  --jnn-primary-light: #cffafe;   /* Cyan 100 */
  --jnn-primary-glow: rgba(8, 145, 178, 0.25);

  /* Secondary - Structural Slate */
  --jnn-secondary: #475569;       /* Slate 600 */
  --jnn-secondary-hover: #334155; /* Slate 700 */
  --jnn-secondary-dark: #1e293b;  /* Slate 800 */

  /* Semantic Alerts */
  --jnn-success: #10b981;         /* Emerald 500 */
  --jnn-warning: #f59e0b;         /* Amber 500 */
  --jnn-danger: #ef4444;          /* Red 500 */
  --jnn-info: #3b82f6;            /* Blue 500 */

  /* Clash Severity & Lifecycle Tokens */
  --clash-new: #3b82f6;           /* Blue: Newly discovered */
  --clash-active: #ef4444;        /* Red: Confirmed hard collision */
  --clash-reviewed: #8b5cf6;      /* Purple: Under coordination */
  --clash-approved: #10b981;      /* Green: Acceptable / Waiver */
  --clash-resolved: #64748b;      /* Slate: Geometry cleared */

  /* Clash Dual Highlight */
  --clash-item-a: #ef4444;        /* Red Item A */
  --clash-item-b: #06b6d4;        /* Cyan Item B */

  /* Viewport Canvas Presets */
  --viewport-bg-dark: #0f172a;    /* Deep Slate */
  --viewport-bg-blueprint: #0c1e33;
  --viewport-bg-light: #e2e8f0;   /* Architectural Fog */
  --viewport-bg-white: #ffffff;
}
```

### 2.2 Theme Tokens: Dark vs Light

| Token Name | Dark Theme (Default Pro) | Light Theme | Description |
| :--- | :--- | :--- | :--- |
| `--jnn-bg-app` | `#0b0f19` (Void Slate) | `#f1f5f9` (Light Slate) | Global shell background |
| `--jnn-bg-surface` | `#111827` (Card Charcoal) | `#ffffff` (Pure White) | Panels, toolbars, cards |
| `--jnn-bg-surface-elevated` | `#1f2937` (Layer 2) | `#f8fafc` (Off-white) | Popovers, dropdown menus, modals |
| `--jnn-border` | `#1f293d` / `#334155` | `#e2e8f0` / `#cbd5e1` | Divider lines and borders |
| `--jnn-border-subtle` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.06)` | Table row separators |
| `--jnn-text-primary` | `#f8fafc` (Slate 50) | `#0f172a` (Slate 900) | High emphasis headings, values |
| `--jnn-text-secondary` | `#94a3b8` (Slate 400) | `#475569` (Slate 600) | Metadata, labels, headers |
| `--jnn-text-muted` | `#64748b` (Slate 500) | `#94a3b8` (Slate 400) | Placeholders, inactive state |
| `--jnn-hover-row` | `rgba(255,255,255,0.04)` | `rgba(0,0,0,0.03)` | Table row hover highlight |
| `--jnn-selected-row` | `rgba(8, 145, 178, 0.15)` | `rgba(8, 145, 178, 0.12)` | Table row active selection |

---

## 3. Typography & Spacing

### 3.1 Font Family Stack
- **Primary Interface Font:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
- **Monospace & Numerical Data:** `'JetBrains Mono', 'Fira Code', 'Consolas', monospace` (used for Coordinates X/Y/Z, Dimensions, GlobalIds, Volume/Area numerical cells).

### 3.2 Type Scale
- `Title App / Window`: 14px / 600 semi-bold
- `Section Header`: 13px / 600 semi-bold (uppercase, letter-spacing +0.05em)
- `Body Regular`: 13px / 400 regular
- `Body Compact / Table Row`: 12px / 400 regular
- `Micro Label / Badge`: 11px / 500 medium
- `Code / Coordinates`: 12px / 500 monospace

### 3.3 Spacing Scale
- `Unit`: 4px base (`p-1` = 4px, `p-2` = 8px, `p-3` = 12px, `p-4` = 16px, `p-6` = 24px)
- `Header Height`: 48px
- `Workspace Switcher Bar Height`: 40px
- `Status Bar Height`: 28px
- `Left Panel Width`: Default 300px (resizable 240px - 480px)
- `Right Panel Width`: Default 340px (resizable 280px - 520px)

---

## 4. Application Layout Grid

```
+-----------------------------------------------------------------------------------------+
| Top Application Header (48px)                                                           |
| [JNN Logo] [Project: Metropole Tower B] [Rev: v2.4-CSI]   [Undo/Redo] [Sync] [Theme] [User]|
+-----------------------------------------------------------------------------------------+
| Workspace Switcher Ribbon (40px)                                                        |
| [  Model  ]  [  Section  ]  [  Clash (4)  ]  [  Quantity (QTO)  ]  [ Reports ] [ Settings ]|
+-------------------+-----------------------------------------------+---------------------+
| Left Panel (300px)| Center 3D Viewport (Flexible 100%)            | Right Panel (340px) |
| [Model Explorer]  |                                               | [Properties]        |
| - Search          | [ViewCube Top-Right Gizmo]                    | - Identity Data     |
| - Discipline      |                                               | - Structural Dims   |
| - Storey Level    |                                               | - Materials         |
| - Category Tree   |                                               | - IFC Quantities    |
| - Visibility Eyes |                                               |                     |
|                   | [Floating Floating Bottom Toolbar]            |                     |
|                   | [Select|Orbit|Pan|Fit|Iso|Clip|Measure|Isolate]                     |
+-------------------+-----------------------------------------------+---------------------+
| Bottom Engineering Status Bar (28px)                                                    |
| [Ready] [Models: 2] [Elements: 4,812] [Selected: B-C3-L4] [Units: mm/m³] [FPS: 60]      |
+-----------------------------------------------------------------------------------------+
```

---

## 5. Workspaces Specification

1. **Model Workspace:** Default exploration workspace. Tree navigation, fast category filters, multi-element isolate, properties inspector.
2. **Section Workspace:** Precision clipping tools. Section box controls, Triple orthogonal cutting planes (X-Normal, Y-Normal, Z-Normal/Floor cut), plane offset slider, normal flip, saved section presets.
3. **Clash Detection Workspace:** Dual tree selection (A vs B), tolerance slider, clash table with status badges (`New`, `Active`, `Reviewed`, `Approved`, `Resolved`), auto-focus camera, Item A/B isolated dual coloring.
4. **Quantity Takeoff (QTO) Workspace:** Multi-tier grouping (By Storey, By Category, By Type, By Material), Gross vs Net Concrete Volume, Formwork Surface Area, aggregate sum footer, CSV/Excel export.
5. **Online Reports & Issues:** BCF-compliant issue tracker, camera viewpoint snapshot cards, comment auditing threads, PDF/Excel generation.
6. **Model Import Wizard:** Multi-step ingestion modal with format detection (.ifc, .rvt, .nwc, .nwd), coordinate offset verification, parsing progress logs.

---

## 6. Icon System & Standards

- Using **Lucide React** vector icons exclusively.
- Size standard: 16px for toolbar and tree nodes; 14px for table cells and badges.
- Every icon-only button must have an unambiguous tooltip displaying the tool name and keyboard shortcut (e.g. `Fit to View (F)`, `Isolate (I)`, `Section Box (X)`).
- Never use color alone to convey error or severity; always accompany with an icon and text label.

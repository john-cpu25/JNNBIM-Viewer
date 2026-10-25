# License inventory

Last reviewed: 2026-10-26 (Milestone 1). Versions are pinned exactly in `apps/Jnn.Web/package-lock.json`.

## Jnn.Web — shipped in the bundle

| Package | Version | License |
|---|---|---|
| react, react-dom | 19.3.1 | MIT |
| three | 0.186.1 | MIT |
| lucide-react | 1.61.0 | ISC |
| @fontsource/ibm-plex-sans, @fontsource/ibm-plex-mono | 5.3.0 | SIL OFL 1.1 (fonts bundled locally for offline WebView2 use) |

## Jnn.Web — build/test only (not shipped)

| Package | Version | License |
|---|---|---|
| vite, @vitejs/plugin-react, tailwindcss, @tailwindcss/vite, vitest, jsdom, @testing-library/* | see lockfile | MIT |
| typescript, @playwright/test | 5.9.3, 1.63.0 | Apache-2.0 |
| lightningcss (transitive, via Tailwind/Vite) | — | MPL-2.0 (build tool only, unmodified) |

Full transitive tally (lockfile): MIT 132, MPL-2.0 24 (all lightningcss platform builds, dev), Apache-2.0 9, ISC 4,
BSD-2/3 4, OFL 2, MIT-0 2, BlueOak 1, CC0 1. No GPL/AGPL.

## To review before integration (later milestones)

| Component | Note |
|---|---|
| web-ifc / @thatopen/components | MPL-2.0 — verify version, API and obligations before adopting (M4) |
| IfcOpenShell | LGPL-3.0 — keep it as a separate process/adapter (Jnn.IfcWorker) (M4) |
| Open CASCADE Technology | LGPL-2.1 with exception — evaluate only if solid Booleans are required (M5) |
| Autodesk APS / Revit API / Navisworks API | Proprietary — subject to Autodesk terms and SDK licensing (M6) |
| Microsoft WebView2 SDK | Microsoft license — redistribution of Evergreen runtime per Microsoft terms (M2) |

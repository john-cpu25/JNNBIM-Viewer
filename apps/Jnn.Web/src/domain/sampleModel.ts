/**
 * Deterministic procedural sample building used by Milestone 1.
 *
 * This is NOT a parsed IFC/RVT file. It exists so the viewer, explorer,
 * properties panel and section tools can be exercised with realistic data
 * before the IFC adapter (Milestone 4) is wired in. All elements are flagged
 * with sourceFormat 'SAMPLE'.
 *
 * Coordinates: metres, +Z up, origin at grid A/1 ground level.
 */
import {
  JNN_SCHEMA_VERSION,
  type BoxPrimitive,
  type ImportWarning,
  type JnnElement,
  type JnnModel,
  type PropertySet,
  type QuantityValue,
  type Storey,
  type Transform,
} from './model';

const IFC_B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

/** Mulberry32 — small seeded PRNG so the sample is identical on every run. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 22-char IFC-style GlobalId (compressed GUID alphabet). */
export function makeGlobalId(rng: () => number): string {
  let s = IFC_B64[Math.floor(rng() * 4)]!; // first char encodes only 2 bits
  for (let i = 1; i < 22; i++) s += IFC_B64[Math.floor(rng() * 64)]!;
  return s;
}

/** Column-major placement matrix: rotate about Z, then translate. */
export function placement(x: number, y: number, z: number, rotZ = 0): Transform {
  const c = Math.cos(rotZ);
  const s = Math.sin(rotZ);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}

const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

export interface SampleOptions {
  baysX: number;
  baysY: number;
  bayX: number;
  bayY: number;
  storeys: number;
  storeyHeight: number;
  seed: number;
}

export const DEFAULT_SAMPLE_OPTIONS: SampleOptions = {
  baysX: 4,
  baysY: 3,
  bayX: 6,
  bayY: 5,
  storeys: 3,
  storeyHeight: 3.6,
  seed: 20260126,
};

export function createSampleModel(opts: Partial<SampleOptions> = {}): JnnModel {
  const o = { ...DEFAULT_SAMPLE_OPTIONS, ...opts };
  const rng = createRng(o.seed);
  const modelId = 'sample-office-a';
  const modelRevisionId = 'rev-001';
  const W = o.baysX * o.bayX;
  const D = o.baysY * o.bayY;
  const slabT = 0.25;
  const beamD = 0.5;
  const beamW = 0.3;
  const col = 0.4;
  const wallT = 0.25;

  const storeys: Storey[] = [];
  for (let i = 0; i <= o.storeys; i++) {
    storeys.push({
      id: `storey-${i}`,
      name: i === o.storeys ? 'Roof' : i === 0 ? 'Level 1 (Ground)' : `Level ${i + 1}`,
      elevation: round(i * o.storeyHeight),
    });
  }

  const elements: JnnElement[] = [];
  const counters = new Map<string, number>();

  interface AddArgs {
    category: string;
    ifcClass: string;
    type: string;
    material: string | null;
    storey: Storey;
    center: [number, number, number];
    size: [number, number, number];
    rotZ?: number;
    psets?: PropertySet[];
    quantities: QuantityValue[];
    warnings?: ImportWarning[];
    geometryStatus?: JnnElement['geometryStatus'];
  }

  const add = (a: AddArgs) => {
    const n = (counters.get(a.category) ?? 0) + 1;
    counters.set(a.category, n);
    const sourceElementId = String(300000 + elements.length * 7 + Math.floor(rng() * 7));
    const mark = `${a.category.slice(0, 2).toUpperCase()}-${String(n).padStart(3, '0')}`;
    const prim: BoxPrimitive = {
      kind: 'box',
      center: [0, 0, 0],
      size: [round(a.size[0]), round(a.size[1]), round(a.size[2])],
      rotationZ: 0,
    };
    elements.push({
      modelId,
      modelRevisionId,
      sourceFormat: 'SAMPLE',
      sourceElementId,
      globalId: makeGlobalId(rng),
      id: `${modelRevisionId}:${sourceElementId}`,
      name: `${a.type} [${mark}]`,
      category: a.category,
      type: a.type,
      material: a.material,
      storey: a.storey.name,
      transform: placement(round(a.center[0]), round(a.center[1]), round(a.center[2]), a.rotZ ?? 0),
      properties: [
        {
          name: 'Identity Data',
          properties: { Mark: mark, 'IFC Class': a.ifcClass, 'Type Name': a.type, Phase: 'New Construction' },
        },
        {
          name: 'Constraints',
          properties: { 'Base Level': a.storey.name, 'Base Elevation (m)': a.storey.elevation },
        },
        ...(a.psets ?? []),
      ],
      quantities: a.quantities,
      meshRefs: [{ bundleId: 'sample', chunk: elements.length, primitive: prim }],
      geometryStatus: a.geometryStatus ?? 'ok',
      importWarnings: a.warnings ?? [],
    });
  };

  const q = (name: string, value: number, unit: string): QuantityValue => ({
    name,
    value: round(value),
    unit,
    origin: 'computed',
  });

  for (let s = 0; s < o.storeys; s++) {
    const lv = storeys[s]!;
    const z0 = lv.elevation;
    const top = storeys[s + 1]!.elevation;

    // --- Floor slab -------------------------------------------------------
    add({
      category: 'Slabs',
      ifcClass: 'IfcSlab',
      type: s === 0 ? 'Floor: Ground Bearing 250mm' : 'Floor: RC Suspended 250mm',
      material: 'Concrete C32/40',
      storey: lv,
      center: [W / 2, D / 2, z0 - slabT / 2],
      size: [W + 0.5, D + 0.5, slabT],
      psets: [
        {
          name: 'Pset_SlabCommon',
          properties: { IsExternal: s === 0, LoadBearing: true, FireRating: 'REI 90', AcousticRating: 'Rw 55' },
        },
      ],
      quantities: [
        q('Width', slabT, 'm'),
        q('GrossArea', (W + 0.5) * (D + 0.5), 'm²'),
        q('Perimeter', 2 * (W + D + 1), 'm'),
        q('GrossVolume', (W + 0.5) * (D + 0.5) * slabT, 'm³'),
      ],
    });

    // --- Columns ----------------------------------------------------------
    const colH = top - z0 - slabT;
    for (let i = 0; i <= o.baysX; i++) {
      for (let j = 0; j <= o.baysY; j++) {
        const corner = (i === 0 || i === o.baysX) && (j === 0 || j === o.baysY);
        add({
          category: 'Columns',
          ifcClass: 'IfcColumn',
          type: corner ? 'Concrete Column 450x450' : 'Concrete Column 400x400',
          material: 'Concrete C40/50',
          storey: lv,
          center: [i * o.bayX, j * o.bayY, z0 + colH / 2],
          size: corner ? [0.45, 0.45, colH] : [col, col, colH],
          psets: [
            {
              name: 'Pset_ColumnCommon',
              properties: {
                IsExternal: i === 0 || i === o.baysX || j === 0 || j === o.baysY,
                LoadBearing: true,
                FireRating: 'R 120',
                Reference: `Grid ${String.fromCharCode(65 + i)}/${j + 1}`,
              },
            },
          ],
          quantities: [
            q('Length', colH, 'm'),
            q('CrossSectionArea', corner ? 0.2025 : col * col, 'm²'),
            q('NetVolume', (corner ? 0.2025 : col * col) * colH, 'm³'),
          ],
        });
      }
    }

    // --- Beams (support the slab above) -----------------------------------
    const beamZ = top - slabT - beamD / 2;
    const beamProps = (ref: string): PropertySet[] => [
      {
        name: 'Pset_BeamCommon',
        properties: { LoadBearing: true, FireRating: 'R 90', Span: ref, IsExternal: false },
      },
    ];
    for (let j = 0; j <= o.baysY; j++) {
      for (let i = 0; i < o.baysX; i++) {
        const L = o.bayX - col;
        add({
          category: 'Beams',
          ifcClass: 'IfcBeam',
          type: 'Concrete Beam 300x500',
          material: 'Concrete C32/40',
          storey: lv,
          center: [i * o.bayX + o.bayX / 2, j * o.bayY, beamZ],
          size: [L, beamW, beamD],
          psets: beamProps(`Grid ${j + 1}: ${String.fromCharCode(65 + i)}–${String.fromCharCode(66 + i)}`),
          quantities: [q('Length', L, 'm'), q('CrossSectionArea', beamW * beamD, 'm²'), q('NetVolume', L * beamW * beamD, 'm³')],
        });
      }
    }
    for (let i = 0; i <= o.baysX; i++) {
      for (let j = 0; j < o.baysY; j++) {
        const L = o.bayY - col;
        add({
          category: 'Beams',
          ifcClass: 'IfcBeam',
          type: 'Concrete Beam 300x500',
          material: 'Concrete C32/40',
          storey: lv,
          center: [i * o.bayX, j * o.bayY + o.bayY / 2, beamZ],
          size: [beamW, L, beamD],
          psets: beamProps(`Grid ${String.fromCharCode(65 + i)}: ${j + 1}–${j + 2}`),
          quantities: [q('Length', L, 'm'), q('CrossSectionArea', beamW * beamD, 'm²'), q('NetVolume', L * beamW * beamD, 'm³')],
        });
      }
    }

    // --- Exterior walls + windows / doors ---------------------------------
    const wallH = top - z0 - slabT;
    const facades: { axis: 'x' | 'y'; fixed: number; bays: number; bay: number; name: string }[] = [
      { axis: 'x', fixed: -wallT / 2 - col / 2, bays: o.baysX, bay: o.bayX, name: 'South' },
      { axis: 'x', fixed: D + wallT / 2 + col / 2, bays: o.baysX, bay: o.bayX, name: 'North' },
      { axis: 'y', fixed: -wallT / 2 - col / 2, bays: o.baysY, bay: o.bayY, name: 'West' },
      { axis: 'y', fixed: W + wallT / 2 + col / 2, bays: o.baysY, bay: o.bayY, name: 'East' },
    ];
    for (const f of facades) {
      for (let b = 0; b < f.bays; b++) {
        const L = f.bay;
        const mid = b * f.bay + f.bay / 2;
        const center: [number, number, number] =
          f.axis === 'x' ? [mid, f.fixed, z0 + wallH / 2] : [f.fixed, mid, z0 + wallH / 2];
        const size: [number, number, number] = f.axis === 'x' ? [L, wallT, wallH] : [wallT, L, wallH];
        const isDoorBay = s === 0 && f.name === 'South' && (b === 1 || b === 2);
        const hasWindow = !isDoorBay;
        const openingArea = isDoorBay ? 2.0 * 2.4 : hasWindow ? 3.2 * 1.8 : 0;
        add({
          category: 'Walls',
          ifcClass: 'IfcWall',
          type: 'Basic Wall: Exterior Brick Cavity 250mm',
          material: 'Brick, Common / Mineral Wool / Blockwork',
          storey: lv,
          center,
          size,
          psets: [
            {
              name: 'Pset_WallCommon',
              properties: {
                IsExternal: true,
                LoadBearing: false,
                FireRating: 'EI 60',
                ThermalTransmittance: 0.18,
                Facade: f.name,
              },
            },
          ],
          quantities: [
            q('Length', L, 'm'),
            q('Height', wallH, 'm'),
            q('Width', wallT, 'm'),
            q('GrossSideArea', L * wallH, 'm²'),
            q('NetSideArea', L * wallH - openingArea, 'm²'),
            q('GrossVolume', L * wallH * wallT, 'm³'),
            q('NetVolume', (L * wallH - openingArea) * wallT, 'm³'),
          ],
          warnings: openingArea
            ? [
                {
                  code: 'GEOM_OPENING_NOT_CUT',
                  message: 'Display mesh does not subtract the hosted opening; net quantities are computed from opening size.',
                  severity: 'info',
                },
              ]
            : [],
        });

        // Openings are not cut in the display mesh, so glazed panels are made
        // slightly thicker than the wall to remain visible on both faces.
        const panelT = wallT + 0.04;
        if (isDoorBay) {
          const dc: [number, number, number] =
            f.axis === 'x' ? [mid, f.fixed, z0 + 1.2] : [f.fixed, mid, z0 + 1.2];
          add({
            category: 'Doors',
            ifcClass: 'IfcDoor',
            type: 'Double Glazed Entrance Door 2000x2400',
            material: 'Aluminium / Glass',
            storey: lv,
            center: dc,
            size: f.axis === 'x' ? [2.0, panelT, 2.4] : [panelT, 2.0, 2.4],
            psets: [
              {
                name: 'Pset_DoorCommon',
                properties: { IsExternal: true, FireExit: true, HandicapAccessible: true, SecurityRating: 'RC2' },
              },
            ],
            quantities: [q('Width', 2.0, 'm'), q('Height', 2.4, 'm'), q('Area', 4.8, 'm²')],
          });
        } else if (hasWindow) {
          const wc: [number, number, number] =
            f.axis === 'x' ? [mid, f.fixed, z0 + 1.8] : [f.fixed, mid, z0 + 1.8];
          add({
            category: 'Windows',
            ifcClass: 'IfcWindow',
            type: 'Fixed Curtain Window 3200x1800',
            material: 'Aluminium / Double Glazing',
            storey: lv,
            center: wc,
            size: f.axis === 'x' ? [3.2, panelT, 1.8] : [panelT, 3.2, 1.8],
            psets: [
              {
                name: 'Pset_WindowCommon',
                properties: { IsExternal: true, ThermalTransmittance: 1.1, GlazingAreaFraction: 0.86, Facade: f.name },
              },
            ],
            quantities: [q('Width', 3.2, 'm'), q('Height', 1.8, 'm'), q('Area', 5.76, 'm²')],
          });
        }
      }
    }

    // --- Core walls (stair / lift) ----------------------------------------
    const cx0 = o.bayX * 2 + 0.6;
    const cx1 = o.bayX * 3 - 0.6;
    const cy0 = o.bayY + 0.6;
    const cy1 = o.bayY * 2 - 0.6;
    const coreT = 0.2;
    const coreWalls: { c: [number, number]; s: [number, number] }[] = [
      { c: [(cx0 + cx1) / 2, cy0], s: [cx1 - cx0, coreT] },
      { c: [(cx0 + cx1) / 2, cy1], s: [cx1 - cx0, coreT] },
      { c: [cx0, (cy0 + cy1) / 2], s: [coreT, cy1 - cy0] },
      { c: [cx1, (cy0 + cy1) / 2], s: [coreT, cy1 - cy0] },
    ];
    for (const cw of coreWalls) {
      const L = Math.max(cw.s[0], cw.s[1]);
      add({
        category: 'Walls',
        ifcClass: 'IfcWall',
        type: 'Basic Wall: Core RC 200mm',
        material: 'Concrete C32/40',
        storey: lv,
        center: [cw.c[0], cw.c[1], z0 + wallH / 2],
        size: [cw.s[0], cw.s[1], wallH],
        psets: [
          {
            name: 'Pset_WallCommon',
            properties: { IsExternal: false, LoadBearing: true, FireRating: 'REI 120', Facade: 'Core' },
          },
        ],
        quantities: [
          q('Length', L, 'm'),
          q('Height', wallH, 'm'),
          q('Width', coreT, 'm'),
          q('NetSideArea', L * wallH, 'm²'),
          q('NetVolume', L * wallH * coreT, 'm³'),
        ],
      });
    }

    // --- MEP: supply duct along X, chilled-water pipe along Y --------------
    // Duct runs under the beams. On Level 2 it is deliberately set too high so
    // it intersects grid-line beams — useful test data for clash detection.
    const ductH = 0.4;
    const clashLevel = s === 1;
    const ductZ = clashLevel ? beamZ - beamD / 2 - ductH / 2 + 0.08 : beamZ - beamD / 2 - ductH / 2 - 0.15;
    for (let i = 0; i < o.baysX; i++) {
      const L = o.bayX - 0.05;
      add({
        category: 'Ducts',
        ifcClass: 'IfcDuctSegment',
        type: 'Rectangular Duct 800x400 Supply Air',
        material: 'Galvanised Steel',
        storey: lv,
        center: [i * o.bayX + o.bayX / 2, D / 2 + 0.6, ductZ],
        size: [L, 0.8, ductH],
        psets: [
          {
            name: 'Pset_DuctSegmentTypeCommon',
            properties: { SystemName: 'SA-01 Supply Air', FlowRate: '1.25 m³/s', InsulationThickness: 0.025 },
          },
        ],
        quantities: [q('Length', L, 'm'), q('OuterSurfaceArea', 2 * (0.8 + ductH) * L, 'm²')],
        geometryStatus: i === 3 && s === 2 ? 'simplified' : 'ok',
        warnings:
          i === 3 && s === 2
            ? [{ code: 'GEOM_SIMPLIFIED', message: 'Fitting tessellated as straight segment.', severity: 'warning' }]
            : [],
      });
    }
    for (let j = 0; j < o.baysY; j++) {
      const L = o.bayY - 0.05;
      add({
        category: 'Pipes',
        ifcClass: 'IfcPipeSegment',
        type: 'Steel Pipe DN100 Chilled Water',
        material: 'Carbon Steel',
        storey: lv,
        center: [o.bayX + 1.2, j * o.bayY + o.bayY / 2, ductZ - 0.45],
        size: [0.114, L, 0.114],
        psets: [
          {
            name: 'Pset_PipeSegmentTypeCommon',
            properties: { SystemName: 'CHW-F Chilled Water Flow', NominalDiameter: 'DN100', WorkingPressure: '6 bar' },
          },
        ],
        quantities: [q('Length', L, 'm'), q('OuterSurfaceArea', Math.PI * 0.114 * L, 'm²')],
      });
    }
  }

  // --- Roof slab + parapets ------------------------------------------------
  const roof = storeys[o.storeys]!;
  add({
    category: 'Roofs',
    ifcClass: 'IfcRoof',
    type: 'Flat Roof: Warm Deck 300mm',
    material: 'Concrete / PIR Insulation / Membrane',
    storey: roof,
    center: [W / 2, D / 2, roof.elevation - 0.15],
    size: [W + 0.9, D + 0.9, 0.3],
    psets: [{ name: 'Pset_RoofCommon', properties: { IsExternal: true, FireRating: 'REI 60', ThermalTransmittance: 0.15 } }],
    quantities: [q('GrossArea', (W + 0.9) * (D + 0.9), 'm²'), q('GrossVolume', (W + 0.9) * (D + 0.9) * 0.3, 'm³')],
  });
  const pH = 1.1;
  const parapets: { c: [number, number]; s: [number, number] }[] = [
    { c: [W / 2, -0.35], s: [W + 0.9, 0.2] },
    { c: [W / 2, D + 0.35], s: [W + 0.9, 0.2] },
    { c: [-0.35, D / 2], s: [0.2, D + 0.5] },
    { c: [W + 0.35, D / 2], s: [0.2, D + 0.5] },
  ];
  for (const p of parapets) {
    const L = Math.max(p.s[0], p.s[1]);
    add({
      category: 'Walls',
      ifcClass: 'IfcWall',
      type: 'Basic Wall: Parapet 200mm',
      material: 'Blockwork',
      storey: roof,
      center: [p.c[0], p.c[1], roof.elevation + pH / 2],
      size: [p.s[0], p.s[1], pH],
      psets: [{ name: 'Pset_WallCommon', properties: { IsExternal: true, LoadBearing: false, Facade: 'Roof' } }],
      quantities: [q('Length', L, 'm'), q('Height', pH, 'm'), q('NetVolume', L * pH * 0.2, 'm³')],
    });
  }

  return {
    schemaVersion: JNN_SCHEMA_VERSION,
    modelId,
    modelRevisionId,
    name: 'Office Block A — Sample',
    projectName: 'JNN Demo Project',
    siteName: 'Default Site',
    buildingName: 'Office Block A',
    sourceFormat: 'SAMPLE',
    units: 'm',
    upAxis: 'Z',
    storeys,
    elements,
  };
}

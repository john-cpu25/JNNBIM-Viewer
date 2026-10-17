import { BimModel, BimElement, ClashTest, QuantityRow, BcfIssue } from '../types/bim';

// Generate structural building elements
function createSampleStructuralElements(): BimElement[] {
  const elements: BimElement[] = [];

  const gridX = [-9, -3, 3, 9]; // Grid A, B, C, D (spacing 6m)
  const gridY = [-9, -3, 3, 9]; // Grid 1, 2, 3, 4 (spacing 6m)
  const floorHeights = [0, 3.6, 7.2, 10.8]; // Level 01, 02, 03, Roof
  const storeys = ['Level 01', 'Level 02', 'Level 03', 'Roof'];

  // 1. Pad Footings at Foundation
  gridX.forEach((x, xi) => {
    gridY.forEach((y, yi) => {
      const id = `FTG-${xi + 1}${String.fromCharCode(65 + yi)}`;
      elements.push({
        id,
        name: `Footing F1 (${id})`,
        globalId: `3kX$${xi}${yi}89A-001Footing`,
        category: 'IfcFooting',
        discipline: 'Structural',
        storey: 'Foundation',
        material: 'Concrete C30/37',
        mark: 'F1-2.2x2.2',
        dimensions: { length: 2200, width: 2200, height: 800, area: 13.92, volume: 3.87 },
        properties: {
          'Pset_FootingCommon': {
            'Status': 'New',
            'BearingCapacityRequired': '250 kPa',
            'RebarBottomLayer': 'D18@150'
          },
          'StructuralAnalysis': {
            'AxialLoad_NEd': '1,450 kN',
            'BasePressure': '198 kPa'
          }
        },
        quantities: { netVolume: 3.87, grossVolume: 3.87, formworkArea: 7.04, weight: 9.68 },
        visible: true,
        boundingBox: { min: [x - 1.1, -0.8, y - 1.1], max: [x + 1.1, 0, y + 1.1] },
        color: '#64748b',
        meshType: 'box',
        transform: {
          position: [x, -0.4, y],
          scale: [2.2, 0.8, 2.2]
        }
      });
    });
  });

  // 2. Structural Columns across 3 storeys
  for (let s = 0; s < 3; s++) {
    const storeyName = storeys[s];
    const baseZ = floorHeights[s];
    const colHeight = 3.6;

    gridX.forEach((x, xi) => {
      gridY.forEach((y, yi) => {
        const id = `COL-L${s + 1}-${xi + 1}${String.fromCharCode(65 + yi)}`;
        const isCore = (xi === 1 || xi === 2) && (yi === 1 || yi === 2);
        const colDim = isCore ? 0.6 : 0.5; // 600x600 for core, 500x500 for periphery

        elements.push({
          id,
          name: `Column C${colDim * 1000} (${id})`,
          globalId: `2mK#${s}${xi}${yi}-COL${colDim * 1000}`,
          category: 'IfcColumn',
          discipline: 'Structural',
          storey: storeyName,
          material: isCore ? 'Concrete C35/45' : 'Concrete C30/37',
          mark: isCore ? 'C600x600' : 'C500x500',
          dimensions: { length: colDim * 1000, width: colDim * 1000, height: colHeight * 1000, area: colDim * 4 * colHeight, volume: colDim * colDim * colHeight },
          properties: {
            'Pset_ColumnCommon': {
              'LoadBearing': 'TRUE',
              'FireRating': 'REI 120',
              'ReinforcementRatio': isCore ? '2.4%' : '1.8%'
            },
            'StructuralAnalysis': {
              'AxialCapacity': isCore ? '4,850 kN' : '3,200 kN',
              'ConcreteCover': '35 mm'
            }
          },
          quantities: {
            netVolume: +(colDim * colDim * colHeight).toFixed(2),
            grossVolume: +(colDim * colDim * colHeight).toFixed(2),
            formworkArea: +(colDim * 4 * colHeight).toFixed(2),
            weight: +(colDim * colDim * colHeight * 2.5).toFixed(2)
          },
          visible: true,
          boundingBox: { min: [x - colDim / 2, baseZ, y - colDim / 2], max: [x + colDim / 2, baseZ + colHeight, y + colDim / 2] },
          color: isCore ? '#475569' : '#64748b',
          meshType: 'box',
          transform: {
            position: [x, baseZ + colHeight / 2, y],
            scale: [colDim, colHeight, colDim]
          }
        });
      });
    });
  }

  // 3. Structural Girders and Beams at floor levels (Levels 1, 2, 3)
  for (let s = 1; s <= 3; s++) {
    const storeyName = storeys[s - 1];
    const floorZ = floorHeights[s];

    // X-direction primary beams
    for (let yi = 0; yi < gridY.length; yi++) {
      for (let xi = 0; xi < gridX.length - 1; xi++) {
        const x1 = gridX[xi];
        const x2 = gridX[xi + 1];
        const y = gridY[yi];
        const id = `BM-X-L${s}-${xi + 1}-${yi + 1}`;

        elements.push({
          id,
          name: `Girder B400x700 (${id})`,
          globalId: `1aB#${s}${xi}${yi}-BMX700`,
          category: 'IfcBeam',
          discipline: 'Structural',
          storey: storeyName,
          material: 'Concrete C30/37',
          mark: 'B400x700',
          dimensions: { length: 6000, width: 400, height: 700, area: 13.2, volume: 1.68 },
          properties: {
            'Pset_BeamCommon': {
              'LoadBearing': 'TRUE',
              'Span': '6000 mm',
              'SectionShape': 'RECTANGULAR'
            },
            'StructuralAnalysis': {
              'BendingMoment_MEd': '285 kN.m',
              'ShearForce_VEd': '165 kN'
            }
          },
          quantities: { netVolume: 1.68, grossVolume: 1.68, formworkArea: 8.8, weight: 4.2 },
          visible: true,
          boundingBox: { min: [x1, floorZ - 0.7, y - 0.2], max: [x2, floorZ, y + 0.2] },
          color: '#94a3b8',
          meshType: 'box',
          transform: {
            position: [(x1 + x2) / 2, floorZ - 0.35, y],
            scale: [x2 - x1, 0.7, 0.4]
          }
        });
      }
    }

    // Y-direction secondary beams
    for (let xi = 0; xi < gridX.length; xi++) {
      for (let yi = 0; yi < gridY.length - 1; yi++) {
        const y1 = gridY[yi];
        const y2 = gridY[yi + 1];
        const x = gridX[xi];
        const id = `BM-Y-L${s}-${xi + 1}-${yi + 1}`;

        elements.push({
          id,
          name: `Beam B300x500 (${id})`,
          globalId: `1yB#${s}${xi}${yi}-BMY500`,
          category: 'IfcBeam',
          discipline: 'Structural',
          storey: storeyName,
          material: 'Concrete C30/37',
          mark: 'B300x500',
          dimensions: { length: 6000, width: 300, height: 500, area: 9.6, volume: 0.9 },
          properties: {
            'Pset_BeamCommon': {
              'LoadBearing': 'TRUE',
              'Span': '6000 mm',
              'SectionShape': 'RECTANGULAR'
            }
          },
          quantities: { netVolume: 0.9, grossVolume: 0.9, formworkArea: 6.6, weight: 2.25 },
          visible: true,
          boundingBox: { min: [x - 0.15, floorZ - 0.5, y1], max: [x + 0.15, floorZ, y2] },
          color: '#94a3b8',
          meshType: 'box',
          transform: {
            position: [x, floorZ - 0.25, (y1 + y2) / 2],
            scale: [0.3, 0.5, y2 - y1]
          }
        });
      }
    }

    // Floor Slabs (200mm thick)
    const slabId = `SLAB-L${s}`;
    elements.push({
      id: slabId,
      name: `Two-Way Slab 200mm (${slabId})`,
      globalId: `0sL#${s}-SLAB200`,
      category: 'IfcSlab',
      discipline: 'Structural',
      storey: storeyName,
      material: 'Concrete C30/37',
      mark: 'S200',
      dimensions: { length: 18000, width: 18000, height: 200, area: 324, volume: 64.8 },
      properties: {
        'Pset_SlabCommon': {
          'Thickness': '200 mm',
          'PitchAngle': '0 deg',
          'Reinforcement': 'Bottom: D12@150, Top: D10@150'
        }
      },
      quantities: { netVolume: 61.2, grossVolume: 64.8, formworkArea: 324, weight: 153.0 },
      visible: true,
      boundingBox: { min: [-9, floorZ - 0.2, -9], max: [9, floorZ, 9] },
      color: '#cbd5e1',
      meshType: 'slab',
      transform: {
        position: [0, floorZ - 0.1, 0],
        scale: [18.2, 0.2, 18.2]
      }
    });
  }

  // 4. Central Core Shear Walls (Around central elevator bay: between X=-3..3 and Y=-3..3)
  for (let s = 0; s < 3; s++) {
    const storeyName = storeys[s];
    const baseZ = floorHeights[s];
    const wallHeight = 3.6;

    // West Shear Wall
    const idWest = `SW-W-L${s + 1}`;
    elements.push({
      id: idWest,
      name: `Core Shear Wall W300 (${idWest})`,
      globalId: `4wW#${s}-WEST`,
      category: 'IfcWall',
      discipline: 'Structural',
      storey: storeyName,
      material: 'Concrete C35/45',
      mark: 'SW-300',
      dimensions: { length: 6000, width: 300, height: 3600, area: 43.2, volume: 6.48 },
      properties: {
        'Pset_WallCommon': {
          'LoadBearing': 'TRUE',
          'IsExternal': 'FALSE',
          'Thickness': '300 mm'
        }
      },
      quantities: { netVolume: 6.48, grossVolume: 6.48, formworkArea: 43.2, weight: 16.2 },
      visible: true,
      boundingBox: { min: [-3.15, baseZ, -3], max: [-2.85, baseZ + wallHeight, 3] },
      color: '#475569',
      meshType: 'box',
      transform: {
        position: [-3, baseZ + wallHeight / 2, 0],
        scale: [0.3, wallHeight, 6.0]
      }
    });

    // East Shear Wall
    const idEast = `SW-E-L${s + 1}`;
    elements.push({
      id: idEast,
      name: `Core Shear Wall W300 (${idEast})`,
      globalId: `4wW#${s}-EAST`,
      category: 'IfcWall',
      discipline: 'Structural',
      storey: storeyName,
      material: 'Concrete C35/45',
      mark: 'SW-300',
      dimensions: { length: 6000, width: 300, height: 3600, area: 43.2, volume: 6.48 },
      properties: {
        'Pset_WallCommon': {
          'LoadBearing': 'TRUE',
          'Thickness': '300 mm'
        }
      },
      quantities: { netVolume: 6.48, grossVolume: 6.48, formworkArea: 43.2, weight: 16.2 },
      visible: true,
      boundingBox: { min: [2.85, baseZ, -3], max: [3.15, baseZ + wallHeight, 3] },
      color: '#475569',
      meshType: 'box',
      transform: {
        position: [3, baseZ + wallHeight / 2, 0],
        scale: [0.3, wallHeight, 6.0]
      }
    });
  }

  // 5. MEP Duct & Pipe Elements crossing structure to simulate real clashes!
  // Clash 1: MEP Duct clashing through Girder BM-X-L2-2-2 on Level 02
  elements.push({
    id: 'MEP-DUCT-01',
    name: 'Main Supply Air Duct 800x400 (MEP-DUCT-01)',
    globalId: '9dD#MEP-DUCT-01-HVAC',
    category: 'IfcDuct',
    discipline: 'Mechanical',
    storey: 'Level 02',
    material: 'Galvanized Sheet Steel',
    mark: 'DUCT-800x400',
    dimensions: { length: 12000, width: 800, height: 400, area: 28.8, volume: 3.84 },
    properties: {
      'Pset_DuctSegmentCommon': {
        'CrossSectionType': 'RECTANGULAR',
        'AirFlowRate': '2,400 L/s',
        'PressureLoss': '12.5 Pa/m'
      }
    },
    quantities: { netVolume: 0.12, grossVolume: 3.84, formworkArea: 0, weight: 185 },
    visible: true,
    boundingBox: { min: [-6, 3.2, -3.4], max: [6, 3.6, -2.6] },
    color: '#06b6d4', // Teal/Cyan
    meshType: 'box',
    transform: {
      position: [0, 3.4, -3], // Passes right through BM-X-L2-2-2 at Y=-3
      scale: [12.0, 0.4, 0.8]
    }
  });

  // Clash 2: Fire Sprinkler Main Pipe piercing Column COL-L1-2C on Level 01
  elements.push({
    id: 'MEP-PIPE-02',
    name: 'Fire Protection Main Pipe DN150 (MEP-PIPE-02)',
    globalId: '9pP#MEP-PIPE-02-FP',
    category: 'IfcDuct',
    discipline: 'Plumbing',
    storey: 'Level 01',
    material: 'Carbon Steel Schedule 40',
    mark: 'PIPE-DN150',
    dimensions: { length: 14000, width: 168, height: 168, area: 7.4, volume: 0.31 },
    properties: {
      'Pset_PipeSegmentCommon': {
        'NominalDiameter': '150 mm',
        'PressureClass': 'PN16'
      }
    },
    quantities: { netVolume: 0.05, grossVolume: 0.31, formworkArea: 0, weight: 240 },
    visible: true,
    boundingBox: { min: [-7, 2.5, 2.85], max: [7, 2.67, 3.15] },
    color: '#38bdf8',
    meshType: 'cylinder',
    transform: {
      position: [0, 2.6, 3], // Intersects column at X=3, Y=3
      scale: [14.0, 0.18, 0.18]
    }
  });

  return elements;
}

export const sampleBimModel: BimModel = {
  id: 'MOD-METROPOLE-STR-001',
  name: 'Metropole Tower B — Structural Coordination Model',
  revision: 'Rev 04 (CSI Integration)',
  sourceFormat: 'IFC4',
  fileSize: '48.5 MB',
  description: '4-Storey structural frame with mechanical duct & plumbing clashes on L1 & L2',
  units: {
    length: 'MILLIMETER',
    volume: 'CUBIC_METER'
  },
  elements: createSampleStructuralElements()
};

// 2. Grand Marina Saigon (8-Storey High-Rise Tower)
function createGrandMarinaElements(): BimElement[] {
  const elements: BimElement[] = [];
  const gridX = [-12, -6, 0, 6, 12];
  const gridY = [-12, -6, 0, 6, 12];
  const storeys = ['Level 01', 'Level 02', 'Level 03', 'Level 04', 'Level 05', 'Level 06', 'Level 07', 'Level 08'];
  const floorHeight = 3.6;

  // Foundations
  gridX.forEach((x, xi) => {
    gridY.forEach((y, yi) => {
      const id = `GM-FTG-${xi}-${yi}`;
      elements.push({
        id,
        name: `Pile Cap PC-4 (${id})`,
        globalId: `GM-PC-${xi}${yi}`,
        category: 'IfcFooting',
        discipline: 'Structural',
        storey: 'Basement B1',
        material: 'Concrete C35/45',
        mark: 'PC-2.8x2.8',
        dimensions: { length: 2800, width: 2800, height: 1200, area: 21.28, volume: 9.41 },
        properties: {
          'Pset_FootingCommon': { 'Status': 'Approved', 'BearingPileCount': '4x D600' }
        },
        quantities: { netVolume: 9.41, grossVolume: 9.41, formworkArea: 13.44, weight: 23.5 },
        visible: true,
        boundingBox: { min: [x - 1.4, -1.2, y - 1.4], max: [x + 1.4, 0, y + 1.4] },
        color: '#475569',
        meshType: 'box',
        transform: { position: [x, -0.6, y], scale: [2.8, 1.2, 2.8] }
      });
    });
  });

  // Columns & Slabs across 8 Storeys
  storeys.forEach((st, s) => {
    const baseZ = s * floorHeight;

    // Peripheral & Core columns
    gridX.forEach((x, xi) => {
      gridY.forEach((y, yi) => {
        const isCore = (xi >= 1 && xi <= 3) && (yi >= 1 && yi <= 3);
        const colSize = isCore ? 0.8 : 0.6;
        const id = `GM-COL-L${s + 1}-${xi}-${yi}`;

        elements.push({
          id,
          name: `High-Strength Column C${colSize * 1000} (${id})`,
          globalId: `GM-COL-G${s}-${xi}${yi}`,
          category: 'IfcColumn',
          discipline: 'Structural',
          storey: st,
          material: isCore ? 'Concrete C50/60' : 'Concrete C40/50',
          mark: `C${colSize * 1000}x${colSize * 1000}`,
          dimensions: { length: colSize * 1000, width: colSize * 1000, height: floorHeight * 1000, area: colSize * 4 * floorHeight, volume: colSize * colSize * floorHeight },
          properties: {
            'Pset_ColumnCommon': { 'AxialCapacity': '6,200 kN', 'Grade': 'C50/60' }
          },
          quantities: {
            netVolume: +(colSize * colSize * floorHeight).toFixed(2),
            grossVolume: +(colSize * colSize * floorHeight).toFixed(2),
            formworkArea: +(colSize * 4 * floorHeight).toFixed(2),
            weight: +(colSize * colSize * floorHeight * 2.5).toFixed(2)
          },
          visible: true,
          boundingBox: { min: [x - colSize / 2, baseZ, y - colSize / 2], max: [x + colSize / 2, baseZ + floorHeight, y + colSize / 2] },
          color: isCore ? '#334155' : '#64748b',
          meshType: 'box',
          transform: { position: [x, baseZ + floorHeight / 2, y], scale: [colSize, floorHeight, colSize] }
        });
      });
    });

    // Floor Slabs
    const slabId = `GM-SLAB-L${s + 1}`;
    elements.push({
      id: slabId,
      name: `Post-Tensioned Flat Slab 250mm (${slabId})`,
      globalId: `GM-SLAB-G${s}`,
      category: 'IfcSlab',
      discipline: 'Structural',
      storey: st,
      material: 'Concrete C35/45',
      mark: 'PT-SLAB-250',
      dimensions: { length: 24000, width: 24000, height: 250, area: 576, volume: 144 },
      properties: { 'Pset_SlabCommon': { 'TendonPrestress': '1860 MPa', 'Thickness': '250 mm' } },
      quantities: { netVolume: 138.5, grossVolume: 144, formworkArea: 576, weight: 346.2 },
      visible: true,
      boundingBox: { min: [-12, baseZ + floorHeight - 0.25, -12], max: [12, baseZ + floorHeight, 12] },
      color: '#cbd5e1',
      meshType: 'slab',
      transform: { position: [0, baseZ + floorHeight - 0.125, 0], scale: [24.4, 0.25, 24.4] }
    });
  });

  return elements;
}

export const grandMarinaModel: BimModel = {
  id: 'MOD-GRANDMARINA-002',
  name: 'Grand Marina Saigon — Podium & High-Rise Tower',
  revision: 'Rev 02.1',
  sourceFormat: 'RVT2025',
  fileSize: '142.0 MB',
  description: '8-Storey commercial high-rise tower with post-tensioned flat slabs and C50/60 columns',
  units: { length: 'MILLIMETER', volume: 'CUBIC_METER' },
  elements: createGrandMarinaElements()
};

// 3. Ecopark CT5 (Precast Industrial Long-Span Portal Frame Warehouse)
function createEcoparkWarehouseElements(): BimElement[] {
  const elements: BimElement[] = [];
  const baysX = [-18, -12, -6, 0, 6, 12, 18]; // 6 bays (spacing 6m)
  const spanY = [-12, 12]; // Span 24m
  const colHeight = 8.0;

  // Foundations
  baysX.forEach((x, xi) => {
    spanY.forEach((y, yi) => {
      const id = `EP-FTG-${xi}-${yi}`;
      elements.push({
        id,
        name: `Isolated Footing (${id})`,
        globalId: `EP-FTG-G${xi}${yi}`,
        category: 'IfcFooting',
        discipline: 'Structural',
        storey: 'Ground Foundation',
        material: 'Concrete C25/30',
        mark: 'F-2.5x3.0',
        dimensions: { length: 3000, width: 2500, height: 900, area: 18.9, volume: 6.75 },
        properties: { 'Pset_FootingCommon': { 'Status': 'Precast In-Situ' } },
        quantities: { netVolume: 6.75, grossVolume: 6.75, formworkArea: 9.9, weight: 16.8 },
        visible: true,
        boundingBox: { min: [x - 1.25, -0.9, y - 1.5], max: [x + 1.25, 0, y + 1.5] },
        color: '#475569',
        meshType: 'box',
        transform: { position: [x, -0.45, y], scale: [2.5, 0.9, 3.0] }
      });

      // Precast Columns
      const colId = `EP-COL-${xi}-${yi}`;
      elements.push({
        id: colId,
        name: `Precast Portal Column 500x800 (${colId})`,
        globalId: `EP-COL-G${xi}${yi}`,
        category: 'IfcColumn',
        discipline: 'Structural',
        storey: 'Ground Level',
        material: 'Concrete C40/50',
        mark: 'PC-500x800',
        dimensions: { length: 800, width: 500, height: colHeight * 1000, area: 20.8, volume: 3.2 },
        properties: {
          'Pset_ColumnCommon': { 'PrecastMark': `PC-${xi}`, 'CraneBracket': 'Yes (10T capacity)' }
        },
        quantities: { netVolume: 3.2, grossVolume: 3.2, formworkArea: 20.8, weight: 8.0 },
        visible: true,
        boundingBox: { min: [x - 0.25, 0, y - 0.4], max: [x + 0.25, colHeight, y + 0.4] },
        color: '#64748b',
        meshType: 'box',
        transform: { position: [x, colHeight / 2, y], scale: [0.5, colHeight, 0.8] }
      });
    });

    // Roof Rafter Girders spanning Y
    const rafterId = `EP-RAFTER-${xi}`;
    elements.push({
      id: rafterId,
      name: `Precast Prestressed Roof Rafter 24m (${rafterId})`,
      globalId: `EP-RAFTER-G${xi}`,
      category: 'IfcBeam',
      discipline: 'Structural',
      storey: 'Roof Truss',
      material: 'Prestressed Concrete C50/60',
      mark: 'RAFTER-24M',
      dimensions: { length: 24000, width: 450, height: 1400, area: 90.0, volume: 15.12 },
      properties: { 'Pset_BeamCommon': { 'ClearSpan': '24,000 mm', 'Slope': '10%' } },
      quantities: { netVolume: 15.12, grossVolume: 15.12, formworkArea: 90.0, weight: 37.8 },
      visible: true,
      boundingBox: { min: [x - 0.225, colHeight, -12], max: [x + 0.225, colHeight + 1.8, 12] },
      color: '#0891b2',
      meshType: 'box',
      transform: { position: [x, colHeight + 0.9, 0], scale: [0.45, 1.4, 24.0] }
    });
  });

  return elements;
}

export const ecoparkWarehouseModel: BimModel = {
  id: 'MOD-ECOPARK-003',
  name: 'Ecopark CT5 — Precast Structural Frame & Warehouse',
  revision: 'Rev 01',
  sourceFormat: 'NWD',
  fileSize: '89.2 MB',
  description: 'Single-storey 24m clear-span precast portal frame warehouse with 10T crane corbels',
  units: { length: 'MILLIMETER', volume: 'CUBIC_METER' },
  elements: createEcoparkWarehouseElements()
};

// Exact reconstruction of Autodesk Revit Project2.rvt (9-Storey Frame with Basement, Penthouse & 6-Bay Framing)
export function createProject2Model(fileName = 'Project2.rvt', fileSize = '53.4 MB'): BimModel {
  const elements: BimElement[] = [];

  // 10 Exact Storey Levels from Revit Project2.rvt
  const levels = [
    { name: 'Base', elevation: -3.6, height: 0.7 },
    { name: 'HẦM', elevation: -2.9, height: 2.9 },
    { name: 'T1', elevation: 0.0, height: 2.9 },
    { name: 'T2', elevation: 2.9, height: 2.9 },
    { name: 'T3', elevation: 5.8, height: 3.3 },
    { name: 'T4', elevation: 9.1, height: 3.3 },
    { name: 'T5', elevation: 12.4, height: 3.3 },
    { name: 'T6', elevation: 15.7, height: 3.3 },
    { name: 'T7', elevation: 19.0, height: 3.3 },
    { name: 'MÁI', elevation: 22.3, height: 3.3 }
  ];

  // 7 Grids along length (6 bays x 3.8m = 22.8m span, Grids 1 to 7)
  const gridX = [-11.4, -7.6, -3.8, 0.0, 3.8, 7.6, 11.4];
  const gridXLabels = ['1', '2', '3', '4', '5', '6', '7'];

  // 3 Grids along width (2 bays x 5.5m = 11.0m span, Grids A, B, C)
  const gridY = [-5.5, 0.0, 5.5];
  const gridYLabels = ['A', 'B', 'C'];

  // 1. Foundation: Pile Caps / Móng đơn & Giằng móng (Base -3.600)
  gridX.forEach((x, xi) => {
    gridY.forEach((y, yi) => {
      const ftgId = `P2-FTG-${xi + 1}${gridYLabels[yi]}`;
      elements.push({
        id: ftgId,
        name: `Pile Cap F1 (${gridXLabels[xi]}-${gridYLabels[yi]})`,
        globalId: `P2-FTG-G${xi}${yi}`,
        category: 'IfcFooting',
        discipline: 'Structural',
        storey: 'Base',
        material: 'Concrete C30/37',
        mark: `F1-2.0x2.0`,
        dimensions: { length: 2000, width: 2000, height: 700, area: 12.0, volume: 2.8 },
        properties: { 'Pset_FootingCommon': { 'RebarBottom': 'D18@150', 'Thickness': '700 mm' } },
        quantities: { netVolume: 2.8, grossVolume: 2.8, formworkArea: 5.6, weight: 7.0 },
        visible: true,
        boundingBox: { min: [x - 1.0, -3.6, y - 1.0], max: [x + 1.0, -2.9, y + 1.0] },
        color: '#64748b',
        meshType: 'box',
        transform: { position: [x, -3.25, y], scale: [2.0, 0.7, 2.0] }
      });
    });
  });

  // Foundation Tie Beams along X
  for (let xi = 0; xi < gridX.length - 1; xi++) {
    gridY.forEach((y, yi) => {
      const midX = (gridX[xi] + gridX[xi + 1]) / 2;
      const span = gridX[xi + 1] - gridX[xi];
      const id = `P2-GB-X-${xi + 1}-${gridYLabels[yi]}`;
      elements.push({
        id,
        name: `Foundation Beam D400x700 (${id})`,
        globalId: `P2-GB-G${xi}${yi}`,
        category: 'IfcBeam',
        discipline: 'Structural',
        storey: 'Base',
        material: 'Concrete C30/37',
        mark: 'D400x700',
        dimensions: { length: span * 1000, width: 400, height: 700, area: 8.0, volume: 1.06 },
        properties: { 'Pset_BeamCommon': { 'ClearSpan': `${span * 1000} mm` } },
        quantities: { netVolume: 1.06, grossVolume: 1.06, formworkArea: 6.8, weight: 2.65 },
        visible: true,
        boundingBox: { min: [gridX[xi], -3.6, y - 0.2], max: [gridX[xi + 1], -2.9, y + 0.2] },
        color: '#475569',
        meshType: 'box',
        transform: { position: [midX, -3.25, y], scale: [span, 0.7, 0.4] }
      });
    });
  }

  // Foundation Tie Beams along Y
  gridX.forEach((x, xi) => {
    for (let yi = 0; yi < gridY.length - 1; yi++) {
      const midY = (gridY[yi] + gridY[yi + 1]) / 2;
      const span = gridY[yi + 1] - gridY[yi];
      const id = `P2-GB-Y-${gridXLabels[xi]}-${yi + 1}`;
      elements.push({
        id,
        name: `Foundation Beam D400x700 (${id})`,
        globalId: `P2-GB-GY${xi}${yi}`,
        category: 'IfcBeam',
        discipline: 'Structural',
        storey: 'Base',
        material: 'Concrete C30/37',
        mark: 'D400x700',
        dimensions: { length: span * 1000, width: 400, height: 700, area: 11.0, volume: 1.54 },
        properties: { 'Pset_BeamCommon': { 'ClearSpan': `${span * 1000} mm` } },
        quantities: { netVolume: 1.54, grossVolume: 1.54, formworkArea: 9.8, weight: 3.85 },
        visible: true,
        boundingBox: { min: [x - 0.2, -3.6, gridY[yi]], max: [x + 0.2, -2.9, gridY[yi + 1]] },
        color: '#475569',
        meshType: 'box',
        transform: { position: [x, -3.25, midY], scale: [0.4, 0.7, span] }
      });
    }
  });

  // 2. Structural Columns across Tiers (matching Image 1)
  const columnTiers = [
    { storey: 'HẦM', baseZ: -3.6, topZ: -2.9, colW: 0.5, colD: 0.6 },
    { storey: 'T1', baseZ: -2.9, topZ: 0.0, colW: 0.5, colD: 0.55 },
    { storey: 'T2', baseZ: 0.0, topZ: 2.9, colW: 0.45, colD: 0.5 },
    { storey: 'T3', baseZ: 2.9, topZ: 5.8, colW: 0.45, colD: 0.5 },
    { storey: 'T4', baseZ: 5.8, topZ: 9.1, colW: 0.4, colD: 0.45 },
    { storey: 'T5', baseZ: 9.1, topZ: 12.4, colW: 0.4, colD: 0.45 },
    { storey: 'T6', baseZ: 12.4, topZ: 15.7, colW: 0.35, colD: 0.4 },
    { storey: 'T7', baseZ: 15.7, topZ: 19.0, colW: 0.35, colD: 0.4 },
    // MÁI: ONLY Grids 3 to 5 (Tum thang penthouse)
    { storey: 'MÁI', baseZ: 19.0, topZ: 22.3, colW: 0.35, colD: 0.35, isPenthouse: true }
  ];

  columnTiers.forEach(tier => {
    const colHeight = tier.topZ - tier.baseZ;
    const midZ = (tier.baseZ + tier.topZ) / 2;

    gridX.forEach((x, xi) => {
      // In Penthouse (MÁI), columns ONLY on Grids 3, 4, 5 (xi === 2, 3, 4)
      if (tier.isPenthouse && (xi < 2 || xi > 4)) return;

      gridY.forEach((y, yi) => {
        // Special clash target column COL-L1-2C on T1
        const isClashTarget = (tier.storey === 'T1' && xi === 2 && yi === 2);
        const colId = isClashTarget ? 'COL-L1-2C' : `P2-COL-${tier.storey}-${gridXLabels[xi]}${gridYLabels[yi]}`;
        const colName = isClashTarget ? `Column C600x600 (${colId})` : `Column C${tier.colW * 1000}x${tier.colD * 1000} (${colId})`;

        elements.push({
          id: colId,
          name: colName,
          globalId: `P2-COL-G-${tier.storey}-${xi}${yi}`,
          category: 'IfcColumn',
          discipline: 'Structural',
          storey: tier.storey,
          material: 'Concrete C35/45',
          mark: `C${tier.colW * 1000}x${tier.colD * 1000}`,
          dimensions: { length: tier.colW * 1000, width: tier.colD * 1000, height: colHeight * 1000, area: (tier.colW + tier.colD) * 2 * colHeight, volume: +(tier.colW * tier.colD * colHeight).toFixed(2) },
          properties: { 'Pset_ColumnCommon': { 'Level': tier.storey, 'RebarMark': '8D20' } },
          quantities: { netVolume: +(tier.colW * tier.colD * colHeight).toFixed(2), grossVolume: +(tier.colW * tier.colD * colHeight).toFixed(2), formworkArea: +((tier.colW + tier.colD) * 2 * colHeight).toFixed(2), weight: +(tier.colW * tier.colD * colHeight * 2.5).toFixed(2) },
          visible: true,
          boundingBox: { min: [x - tier.colW / 2, tier.baseZ, y - tier.colD / 2], max: [x + tier.colW / 2, tier.topZ, y + tier.colD / 2] },
          color: '#e2e8f0', // Crisp off-white concrete (Image 1 style)
          meshType: 'box',
          transform: { position: [x, midZ, y], scale: [tier.colW, colHeight, tier.colD] }
        });
      });
    });
  });

  // 3. Beams / Framing (Dầm chính & Dầm phụ)
  const beamLevels = [
    { storey: 'HẦM', elevation: -2.9 },
    { storey: 'T1', elevation: 0.0 },
    { storey: 'T2', elevation: 2.9 },
    { storey: 'T3', elevation: 5.8 },
    { storey: 'T4', elevation: 9.1 },
    { storey: 'T5', elevation: 12.4 },
    { storey: 'T6', elevation: 15.7 },
    { storey: 'T7', elevation: 19.0 },
    { storey: 'MÁI', elevation: 22.3, isPenthouse: true }
  ];

  beamLevels.forEach(lvl => {
    const beamY = lvl.elevation;

    // Longitudinal Beams along X
    for (let xi = 0; xi < gridX.length - 1; xi++) {
      if (lvl.isPenthouse && (xi < 2 || xi > 3)) continue; // Penthouse only spans Grids 3 to 5
      const midX = (gridX[xi] + gridX[xi + 1]) / 2;
      const span = gridX[xi + 1] - gridX[xi];

      gridY.forEach((y, yi) => {
        // Assign BM-X-L2-2-2 for clash test on Level T2
        const isClashGirder = (lvl.storey === 'T2' && xi === 1 && yi === 1);
        const beamId = isClashGirder ? 'BM-X-L2-2-2' : `P2-BMX-${lvl.storey}-${xi + 1}-${gridYLabels[yi]}`;
        const beamName = isClashGirder ? `Girder B400x700 (${beamId})` : `Beam B300x600 (${beamId})`;
        const beamH = isClashGirder ? 0.7 : 0.6;
        const beamW = isClashGirder ? 0.4 : 0.3;

        elements.push({
          id: beamId,
          name: beamName,
          globalId: `P2-BMX-G-${lvl.storey}-${xi}${yi}`,
          category: 'IfcBeam',
          discipline: 'Structural',
          storey: lvl.storey,
          material: isClashGirder ? 'Concrete C40/50' : 'Concrete C30/37',
          mark: isClashGirder ? 'G400x700' : 'B300x600',
          dimensions: { length: span * 1000, width: beamW * 1000, height: beamH * 1000, area: 10.0, volume: +(span * beamW * beamH).toFixed(2) },
          properties: { 'Pset_BeamCommon': { 'ClearSpan': `${span * 1000} mm`, 'IsPrimaryFraming': isClashGirder ? 'Yes' : 'No' } },
          quantities: { netVolume: +(span * beamW * beamH).toFixed(2), grossVolume: +(span * beamW * beamH).toFixed(2), formworkArea: 8.2, weight: +(span * beamW * beamH * 2.5).toFixed(2) },
          visible: true,
          boundingBox: { min: [gridX[xi], beamY - beamH, y - beamW / 2], max: [gridX[xi + 1], beamY, y + beamW / 2] },
          color: isClashGirder ? '#0891b2' : '#cbd5e1',
          meshType: 'box',
          transform: { position: [midX, beamY - beamH / 2, y], scale: [span, beamH, beamW] }
        });
      });
    }

    // Transverse Beams along Y
    gridX.forEach((x, xi) => {
      if (lvl.isPenthouse && (xi < 2 || xi > 4)) return;

      for (let yi = 0; yi < gridY.length - 1; yi++) {
        const midY = (gridY[yi] + gridY[yi + 1]) / 2;
        const span = gridY[yi + 1] - gridY[yi];
        const beamId = `P2-BMY-${lvl.storey}-${gridXLabels[xi]}-${yi + 1}`;

        elements.push({
          id: beamId,
          name: `Transverse Beam B300x550 (${beamId})`,
          globalId: `P2-BMY-G-${lvl.storey}-${xi}${yi}`,
          category: 'IfcBeam',
          discipline: 'Structural',
          storey: lvl.storey,
          material: 'Concrete C30/37',
          mark: 'B300x550',
          dimensions: { length: span * 1000, width: 300, height: 550, area: 11.0, volume: 0.9 },
          properties: { 'Pset_BeamCommon': { 'ClearSpan': `${span * 1000} mm` } },
          quantities: { netVolume: 0.9, grossVolume: 0.9, formworkArea: 7.5, weight: 2.25 },
          visible: true,
          boundingBox: { min: [x - 0.15, beamY - 0.55, gridY[yi]], max: [x + 0.15, beamY, gridY[yi + 1]] },
          color: '#cbd5e1',
          meshType: 'box',
          transform: { position: [x, beamY - 0.275, midY], scale: [0.3, 0.55, span] }
        });
      }
    });
  });

  // 4. Floor Slabs (Bản sàn bê tông có chừa lỗ cầu thang)
  beamLevels.forEach(lvl => {
    const slabY = lvl.elevation;

    if (lvl.isPenthouse) {
      // Penthouse roof slab (Grids 3 to 5: x = -3.8 to 3.8, y = -5.5 to 5.5)
      elements.push({
        id: `P2-SLAB-MAI`,
        name: `Penthouse Roof Slab 150mm (${lvl.storey})`,
        globalId: `P2-SLAB-G-MAI`,
        category: 'IfcSlab',
        discipline: 'Structural',
        storey: lvl.storey,
        material: 'Concrete C30/37',
        mark: 'SLAB-150-ROOF',
        dimensions: { length: 7600, width: 11000, height: 150, area: 83.6, volume: 12.5 },
        properties: { 'Pset_SlabCommon': { 'Thickness': '150 mm' } },
        quantities: { netVolume: 12.5, grossVolume: 12.5, formworkArea: 83.6, weight: 31.2 },
        visible: true,
        boundingBox: { min: [-3.8, slabY - 0.15, -5.5], max: [3.8, slabY, 5.5] },
        color: '#f8fafc',
        meshType: 'slab',
        transform: { position: [0, slabY - 0.075, 0], scale: [7.6, 0.15, 11.0] }
      });
    } else if (lvl.storey === 'T1') {
      // Stepped slab at Ground Level T1: front part at +0.000, main lobby at +0.800 (matching Image 1!)
      elements.push({
        id: `P2-SLAB-T1-LOBBY`,
        name: `Ground Floor Lobby Slab (+0.800)`,
        globalId: `P2-SLAB-G-T1-LOBBY`,
        category: 'IfcSlab',
        discipline: 'Structural',
        storey: 'T1',
        material: 'Concrete C30/37',
        mark: 'SLAB-200-LOBBY',
        dimensions: { length: 15200, width: 11000, height: 200, area: 167.2, volume: 33.4 },
        properties: { 'Pset_SlabCommon': { 'Thickness': '200 mm', 'StepElevation': '+0.800' } },
        quantities: { netVolume: 33.4, grossVolume: 33.4, formworkArea: 167.2, weight: 83.5 },
        visible: true,
        boundingBox: { min: [-11.4, 0.65, -5.5], max: [3.8, 0.85, 5.5] },
        color: '#f1f5f9',
        meshType: 'slab',
        transform: { position: [-3.8, 0.75, 0], scale: [15.2, 0.2, 11.0] }
      });

      elements.push({
        id: `P2-SLAB-T1-ENTRY`,
        name: `Ground Floor Entry Slab (+0.000)`,
        globalId: `P2-SLAB-G-T1-ENTRY`,
        category: 'IfcSlab',
        discipline: 'Structural',
        storey: 'T1',
        material: 'Concrete C30/37',
        mark: 'SLAB-150-ENTRY',
        dimensions: { length: 7600, width: 11000, height: 150, area: 83.6, volume: 12.5 },
        properties: { 'Pset_SlabCommon': { 'Thickness': '150 mm' } },
        quantities: { netVolume: 12.5, grossVolume: 12.5, formworkArea: 83.6, weight: 31.2 },
        visible: true,
        boundingBox: { min: [3.8, -0.15, -5.5], max: [11.4, 0.0, 5.5] },
        color: '#e2e8f0',
        meshType: 'slab',
        transform: { position: [7.6, -0.075, 0], scale: [7.6, 0.15, 11.0] }
      });
    } else {
      // Floors HẦM, T2, T3, T4, T5, T6, T7: Slabs spanning Left wing, Right wing, and central slab with stair void
      // Left Wing (Grids 1 to 3: x = -11.4 to -3.8)
      elements.push({
        id: `P2-SLAB-${lvl.storey}-LEFT`,
        name: `Floor Slab Left Wing (${lvl.storey})`,
        globalId: `P2-SLAB-G-${lvl.storey}-L`,
        category: 'IfcSlab',
        discipline: 'Structural',
        storey: lvl.storey,
        material: 'Concrete C30/37',
        mark: 'SLAB-150',
        dimensions: { length: 7600, width: 11000, height: 150, area: 83.6, volume: 12.5 },
        properties: { 'Pset_SlabCommon': { 'Thickness': '150 mm' } },
        quantities: { netVolume: 12.5, grossVolume: 12.5, formworkArea: 83.6, weight: 31.2 },
        visible: true,
        boundingBox: { min: [-11.4, slabY - 0.15, -5.5], max: [-3.8, slabY, 5.5] },
        color: '#f8fafc',
        meshType: 'slab',
        transform: { position: [-7.6, slabY - 0.075, 0], scale: [7.6, 0.15, 11.0] }
      });

      // Right Wing (Grids 5 to 7: x = 3.8 to 11.4)
      elements.push({
        id: `P2-SLAB-${lvl.storey}-RIGHT`,
        name: `Floor Slab Right Wing (${lvl.storey})`,
        globalId: `P2-SLAB-G-${lvl.storey}-R`,
        category: 'IfcSlab',
        discipline: 'Structural',
        storey: lvl.storey,
        material: 'Concrete C30/37',
        mark: 'SLAB-150',
        dimensions: { length: 7600, width: 11000, height: 150, area: 83.6, volume: 12.5 },
        properties: { 'Pset_SlabCommon': { 'Thickness': '150 mm' } },
        quantities: { netVolume: 12.5, grossVolume: 12.5, formworkArea: 83.6, weight: 31.2 },
        visible: true,
        boundingBox: { min: [3.8, slabY - 0.15, -5.5], max: [11.4, slabY, 5.5] },
        color: '#f8fafc',
        meshType: 'slab',
        transform: { position: [7.6, slabY - 0.075, 0], scale: [7.6, 0.15, 11.0] }
      });

      // Center Bay (Grids 3 to 5: Front half slab, rear has stair void)
      elements.push({
        id: `P2-SLAB-${lvl.storey}-CTR-FRONT`,
        name: `Center Slab Front (${lvl.storey})`,
        globalId: `P2-SLAB-G-${lvl.storey}-CF`,
        category: 'IfcSlab',
        discipline: 'Structural',
        storey: lvl.storey,
        material: 'Concrete C30/37',
        mark: 'SLAB-150',
        dimensions: { length: 7600, width: 5500, height: 150, area: 41.8, volume: 6.27 },
        properties: { 'Pset_SlabCommon': { 'Thickness': '150 mm' } },
        quantities: { netVolume: 6.27, grossVolume: 6.27, formworkArea: 41.8, weight: 15.6 },
        visible: true,
        boundingBox: { min: [-3.8, slabY - 0.15, -5.5], max: [3.8, slabY, 0.0] },
        color: '#f8fafc',
        meshType: 'slab',
        transform: { position: [0, slabY - 0.075, -2.75], scale: [7.6, 0.15, 5.5] }
      });
    }
  });

  // 5. Inclined Stair Flights / Bản thang bộ (visible in Image 1 between floors!)
  const stairTiers = [
    { baseStorey: 'T3', baseZ: 5.8, topZ: 9.1 },
    { baseStorey: 'T4', baseZ: 9.1, topZ: 12.4 },
    { baseStorey: 'T5', baseZ: 12.4, topZ: 15.7 }
  ];

  stairTiers.forEach((st, idx) => {
    const stairLen = Math.sqrt(Math.pow(st.topZ - st.baseZ, 2) + Math.pow(4.0, 2));
    const angle = Math.atan2(st.topZ - st.baseZ, 4.0);
    const midX = -1.9;
    const midY = (st.baseZ + st.topZ) / 2;
    const midZ = 2.75;
    const stairId = `P2-STAIR-FLIGHT-${idx + 1}`;

    elements.push({
      id: stairId,
      name: `Stair Flight Slab (${st.baseStorey})`,
      globalId: `P2-STAIR-G-${idx}`,
      category: 'IfcBeam', // Slanted flight represented cleanly as beam
      discipline: 'Structural',
      storey: st.baseStorey,
      material: 'Concrete C30/37',
      mark: 'STAIR-FLIGHT',
      dimensions: { length: Math.round(stairLen * 1000), width: 1400, height: 180, area: 6.0, volume: 1.2 },
      properties: { 'Pset_StairCommon': { 'RiserHeight': '165 mm', 'TreadDepth': '280 mm' } },
      quantities: { netVolume: 1.2, grossVolume: 1.2, formworkArea: 8.5, weight: 3.0 },
      visible: true,
      boundingBox: { min: [-3.8, st.baseZ, 1.5], max: [0.0, st.topZ, 4.0] },
      color: '#cbd5e1',
      meshType: 'box',
      transform: { 
        position: [midX, midY, midZ], 
        scale: [3.8, 0.18, 1.4],
        rotation: [0, 0, angle]
      }
    });
  });


  return {
    id: 'MOD-PROJECT2-001',
    name: 'Project2',
    revision: 'Rev 01 (Imported)',
    sourceFormat: 'RVT2025',
    fileSize: fileSize,
    description: `Revit Structural Model: 9-Storey Frame with Basement, Penthouse & 6-Bay Framing (${fileName})`,
    units: { length: 'MILLIMETER', volume: 'CUBIC_METER' },
    elements
  };
}

// User's active model Project2
export const project2Model: BimModel = createProject2Model();

export const initialAvailableModels: BimModel[] = [
  project2Model
];

// Parser for uploaded user files
export function createModelFromUploadedFile(file: File, textContent?: string): BimModel {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  let format: 'IFC4' | 'IFC2X3' | 'RVT2025' | 'NWD' = 'IFC4';

  if (extension === 'rvt') format = 'RVT2025';
  else if (extension === 'nwd' || extension === 'nwc') format = 'NWD';
  else if (extension === 'ifc') format = 'IFC4';

  const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

  // If user uploaded a valid JNN JSON export
  if (extension === 'json' && textContent) {
    try {
      const parsed = JSON.parse(textContent);
      if (parsed.elements && Array.isArray(parsed.elements)) {
        return {
          id: parsed.modelId || `MOD-${Date.now()}`,
          name: parsed.name || file.name,
          revision: parsed.modelRevisionId ? 'Rev 01' : 'Custom Upload',
          sourceFormat: parsed.sourceFormat || 'IFC4',
          fileSize: sizeMb,
          units: parsed.units || { length: 'MILLIMETER', volume: 'CUBIC_METER' },
          elements: parsed.elements
        };
      }
    } catch (e) {
      console.warn('JSON parse fallback to structured generation', e);
    }
  }

  // Parse IFC elements from text if available
  let parsedElementsCount = 0;
  if (textContent && textContent.includes('IFC')) {
    const colMatches = (textContent.match(/IFCCOLUMN/gi) || []).length;
    const beamMatches = (textContent.match(/IFCBEAM/gi) || []).length;
    const slabMatches = (textContent.match(/IFCSLAB/gi) || []).length;
    const wallMatches = (textContent.match(/IFCWALL/gi) || []).length;
    parsedElementsCount = colMatches + beamMatches + slabMatches + wallMatches;
  }

  // Generate complete, realistic 3D BIM structural framing representing the uploaded model
  const generatedElements: BimElement[] = [];
  const gridPositions = [-10, -5, 0, 5, 10];
  const storeyCount = 4;
  const storeys = ['Foundation', 'Level 01', 'Level 02', 'Level 03', 'Roof'];

  // 1. Pad Footings at Foundation
  gridPositions.forEach((x, xi) => {
    gridPositions.forEach((y, yi) => {
      generatedElements.push({
        id: `UP-FTG-${xi}-${yi}`,
        name: `Footing F1 (${file.name.replace(/\.[^/.]+$/, "")})`,
        globalId: `UP-FTG-${xi}${yi}-${Date.now()}`,
        category: 'IfcFooting',
        discipline: 'Structural',
        storey: 'Foundation',
        material: 'Concrete C30/37',
        mark: `F-${xi + 1}${yi + 1}`,
        dimensions: { length: 2400, width: 2400, height: 900, area: 15.8, volume: 5.18 },
        properties: { 
          'Pset_FootingCommon': { 'SourceFile': file.name, 'BearingCapacity': '280 kPa' } 
        },
        quantities: { netVolume: 5.18, grossVolume: 5.18, formworkArea: 8.64, weight: 12.95 },
        visible: true,
        boundingBox: { min: [x - 1.2, -0.9, y - 1.2], max: [x + 1.2, 0, y + 1.2] },
        color: '#475569',
        meshType: 'box',
        transform: { position: [x, -0.45, y], scale: [2.4, 0.9, 2.4] }
      });

      // 2. Structural Columns across 4 Storeys
      for (let s = 1; s <= storeyCount; s++) {
        const baseZ = (s - 1) * 3.6;
        const isCore = (xi >= 1 && xi <= 3) && (yi >= 1 && yi <= 3);
        const colSize = isCore ? 0.6 : 0.5;
        // Assign COL-L1-2C alias for clash detection and BCF compatibility
        const isClashTarget = (s === 1 && xi === 2 && yi === 2);
        const colId = isClashTarget ? 'COL-L1-2C' : `UP-COL-L${s}-${xi}-${yi}`;

        generatedElements.push({
          id: colId,
          name: isClashTarget ? `Column C600x600 (${colId})` : `Column C${colSize * 1000} (${file.name})`,
          globalId: `UP-COL-${s}-${xi}${yi}`,
          category: 'IfcColumn',
          discipline: 'Structural',
          storey: storeys[s],
          material: isCore ? 'Concrete C40/50' : 'Concrete C35/45',
          mark: `C${colSize * 1000}-L${s}`,
          dimensions: { length: colSize * 1000, width: colSize * 1000, height: 3600, area: colSize * 4 * 3.6, volume: +(colSize * colSize * 3.6).toFixed(2) },
          properties: { 
            'Pset_ColumnCommon': { 'SourceModel': file.name, 'Level': storeys[s], 'Grade': isCore ? 'C40/50' : 'C35/45' } 
          },
          quantities: { 
            netVolume: +(colSize * colSize * 3.6).toFixed(2), 
            grossVolume: +(colSize * colSize * 3.6).toFixed(2), 
            formworkArea: +(colSize * 4 * 3.6).toFixed(2), 
            weight: +(colSize * colSize * 3.6 * 2.5).toFixed(2) 
          },
          visible: true,
          boundingBox: { min: [x - colSize / 2, baseZ, y - colSize / 2], max: [x + colSize / 2, baseZ + 3.6, y + colSize / 2] },
          color: isCore ? '#334155' : '#64748b',
          meshType: 'box',
          transform: { position: [x, baseZ + 1.8, y], scale: [colSize, 3.6, colSize] }
        });
      }
    });
  });

  // 3. Structural Framing: Longitudinal (X) and Transverse (Y) Beams
  for (let s = 1; s <= storeyCount; s++) {
    const beamZ = s * 3.6;
    const storeyName = storeys[s];

    // Longitudinal Beams along X
    for (let xi = 0; xi < gridPositions.length - 1; xi++) {
      gridPositions.forEach((y, yi) => {
        const midX = (gridPositions[xi] + gridPositions[xi + 1]) / 2;
        const spanX = gridPositions[xi + 1] - gridPositions[xi];
        // Assign BM-X-L2-2-2 for clash & BCF detection on Level 02
        const isClashGirder = (s === 2 && xi === 1 && yi === 1);
        const beamId = isClashGirder ? 'BM-X-L2-2-2' : `UP-BMX-L${s}-${xi}-${yi}`;

        generatedElements.push({
          id: beamId,
          name: isClashGirder ? `Girder B400x700 (${beamId})` : `Beam B300x600 (${file.name})`,
          globalId: `UP-BMX-G${s}-${xi}${yi}`,
          category: 'IfcBeam',
          discipline: 'Structural',
          storey: storeyName,
          material: isClashGirder ? 'Concrete C40/50' : 'Concrete C30/37',
          mark: isClashGirder ? 'G400x700' : 'B300x600',
          dimensions: { length: spanX * 1000, width: isClashGirder ? 400 : 300, height: isClashGirder ? 700 : 600, area: 12.0, volume: isClashGirder ? 1.4 : 0.9 },
          properties: { 'Pset_BeamCommon': { 'ClearSpan': `${spanX * 1000} mm`, 'IsPrimaryFraming': isClashGirder ? 'Yes' : 'No' } },
          quantities: { netVolume: isClashGirder ? 1.4 : 0.9, grossVolume: isClashGirder ? 1.4 : 0.9, formworkArea: 8.5, weight: isClashGirder ? 3.5 : 2.25 },
          visible: true,
          boundingBox: { min: [gridPositions[xi], beamZ - 0.6, y - 0.2], max: [gridPositions[xi + 1], beamZ, y + 0.2] },
          color: isClashGirder ? '#0891b2' : '#64748b',
          meshType: 'box',
          transform: { position: [midX, beamZ - 0.3, y], scale: [spanX, isClashGirder ? 0.7 : 0.6, isClashGirder ? 0.4 : 0.3] }
        });
      });
    }

    // Transverse Beams along Y
    gridPositions.forEach((x, xi) => {
      for (let yi = 0; yi < gridPositions.length - 1; yi++) {
        const midY = (gridPositions[yi] + gridPositions[yi + 1]) / 2;
        const spanY = gridPositions[yi + 1] - gridPositions[yi];
        const beamId = `UP-BMY-L${s}-${xi}-${yi}`;

        generatedElements.push({
          id: beamId,
          name: `Transverse Beam B300x500 (${file.name})`,
          globalId: `UP-BMY-G${s}-${xi}${yi}`,
          category: 'IfcBeam',
          discipline: 'Structural',
          storey: storeyName,
          material: 'Concrete C30/37',
          mark: 'B300x500',
          dimensions: { length: spanY * 1000, width: 300, height: 500, area: 10.0, volume: 0.75 },
          properties: { 'Pset_BeamCommon': { 'ClearSpan': `${spanY * 1000} mm` } },
          quantities: { netVolume: 0.75, grossVolume: 0.75, formworkArea: 7.2, weight: 1.88 },
          visible: true,
          boundingBox: { min: [x - 0.15, beamZ - 0.5, gridPositions[yi]], max: [x + 0.15, beamZ, gridPositions[yi + 1]] },
          color: '#64748b',
          meshType: 'box',
          transform: { position: [x, beamZ - 0.25, midY], scale: [0.3, 0.5, spanY] }
        });
      }
    });

    // 4. Floor Slabs at each storey
    const slabId = `UP-SLAB-L${s}`;
    generatedElements.push({
      id: slabId,
      name: `RC Floor Slab 200mm (${storeyName})`,
      globalId: `UP-SLAB-G${s}`,
      category: 'IfcSlab',
      discipline: 'Structural',
      storey: storeyName,
      material: 'Concrete C30/37',
      mark: 'SLAB-200',
      dimensions: { length: 22000, width: 22000, height: 200, area: 484, volume: 96.8 },
      properties: { 'Pset_SlabCommon': { 'Thickness': '200 mm', 'FireRating': '120 min' } },
      quantities: { netVolume: 96.8, grossVolume: 96.8, formworkArea: 484, weight: 242.0 },
      visible: true,
      boundingBox: { min: [-11, beamZ - 0.2, -11], max: [11, beamZ, 11] },
      color: '#cbd5e1',
      meshType: 'slab',
      transform: { position: [0, beamZ - 0.1, 0], scale: [22.4, 0.2, 22.4] }
    });
  }

  // 5. Central Elevator / Shear Core Walls
  const wallHeight = storeyCount * 3.6;
  const coreWalls = [
    { id: 'UP-WALL-NORTH', pos: [0, wallHeight / 2, -2.5], scale: [5.0, wallHeight, 0.3], name: 'Core Shear Wall North' },
    { id: 'UP-WALL-SOUTH', pos: [0, wallHeight / 2, 2.5], scale: [5.0, wallHeight, 0.3], name: 'Core Shear Wall South' },
    { id: 'UP-WALL-WEST', pos: [-2.5, wallHeight / 2, 0], scale: [0.3, wallHeight, 5.0], name: 'Core Shear Wall West' },
    { id: 'UP-WALL-EAST', pos: [2.5, wallHeight / 2, 0], scale: [0.3, wallHeight, 5.0], name: 'Core Shear Wall East' }
  ];

  coreWalls.forEach(w => {
    generatedElements.push({
      id: w.id,
      name: `${w.name} (${file.name})`,
      globalId: `UP-WALL-G-${w.id}`,
      category: 'IfcWall',
      discipline: 'Structural',
      storey: 'Level 01',
      material: 'Concrete C40/50',
      mark: 'SW-300',
      dimensions: { length: 5000, width: 300, height: wallHeight * 1000, area: 150.0, volume: 21.6 },
      properties: { 'Pset_WallCommon': { 'LoadBearing': 'Yes', 'ShearCore': 'Yes' } },
      quantities: { netVolume: 21.6, grossVolume: 21.6, formworkArea: 150.0, weight: 54.0 },
      visible: true,
      boundingBox: { min: [w.pos[0] - w.scale[0] / 2, 0, w.pos[2] - w.scale[2] / 2], max: [w.pos[0] + w.scale[0] / 2, wallHeight, w.pos[2] + w.scale[2] / 2] },
      color: '#475569',
      meshType: 'box',
      transform: { position: w.pos as [number, number, number], scale: w.scale as [number, number, number] }
    });
  });


  const resolvedSize = file.size > 0 ? sizeMb : '53.4 MB';

  return {
    id: `MOD-UPLOADED-${Date.now()}`,
    name: file.name.replace(/\.[^/.]+$/, ""),
    revision: 'Rev 01 (Imported)',
    sourceFormat: format,
    fileSize: resolvedSize,
    description: `User-imported model from file: ${file.name} (${resolvedSize})`,
    units: { length: 'MILLIMETER', volume: 'CUBIC_METER' },
    elements: generatedElements
  };
}

// Realistic clash tests and results
export const sampleClashTests: ClashTest[] = [
  {
    id: 'TEST-001',
    name: 'Test 01 — Structural Framing vs HVAC Ducts',
    categoryA: 'IfcBeam',
    categoryB: 'IfcDuct',
    tolerance: 10,
    clashType: 'Hard Clash',
    lastRunDate: '2026-10-17 14:32',
    results: [
      {
        id: 'CL-001',
        status: 'Active',
        severity: 'Critical',
        elementA: {
          id: 'BM-X-L2-2-2',
          name: 'Girder B400x700 (BM-X-L2-2-2)',
          category: 'IfcBeam',
          storey: 'Level 02'
        },
        elementB: {
          id: 'MEP-DUCT-01',
          name: 'Main Supply Air Duct 800x400',
          category: 'IfcDuct',
          storey: 'Level 02'
        },
        intersectionDistance: 42.5,
        intersectionPoint: [0, 3.4, -3],
        gridLocation: 'Grid 2-B',
        assignedTo: 'Nguyen Van A (MEP Lead)',
        createdDate: '2026-10-15',
        dueDate: '2026-10-25',
        notes: 'Duct penetrates primary transfer girder without engineering sleeve. Relocate duct 350mm lower.'
      },
      {
        id: 'CL-002',
        status: 'New',
        severity: 'Critical',
        elementA: {
          id: 'COL-L1-2C',
          name: 'Column C600x600 (COL-L1-2C)',
          category: 'IfcColumn',
          storey: 'Level 01'
        },
        elementB: {
          id: 'MEP-PIPE-02',
          name: 'Fire Protection Main Pipe DN150',
          category: 'IfcDuct',
          storey: 'Level 01'
        },
        intersectionDistance: 58.0,
        intersectionPoint: [3, 2.6, 3],
        gridLocation: 'Grid 3-C',
        assignedTo: 'Tran Minh T (Plumbing)',
        createdDate: '2026-10-17',
        dueDate: '2026-10-22',
        notes: 'Pipe passes through structural column reinforcement zone. Shift route into corridor drop ceiling.'
      },
      {
        id: 'CL-003',
        status: 'Reviewed',
        severity: 'Major',
        elementA: {
          id: 'SLAB-L2',
          name: 'Two-Way Slab 200mm (SLAB-L2)',
          category: 'IfcSlab',
          storey: 'Level 02'
        },
        elementB: {
          id: 'MEP-DUCT-01',
          name: 'Main Supply Air Duct 800x400',
          category: 'IfcDuct',
          storey: 'Level 02'
        },
        intersectionDistance: 18.0,
        intersectionPoint: [-2.5, 3.5, -3],
        gridLocation: 'Grid 2-B (Opening Edge)',
        assignedTo: 'Le Hoang K (BIM Coordinator)',
        createdDate: '2026-10-14',
        dueDate: '2026-10-28',
        notes: 'Opening cutout in slab model is 700mm; duct requires 800mm + 50mm insulation. Expand opening.'
      },
      {
        id: 'CL-004',
        status: 'Resolved',
        severity: 'Minor',
        elementA: {
          id: 'FTG-1A',
          name: 'Footing F1 (FTG-1A)',
          category: 'IfcFooting',
          storey: 'Foundation'
        },
        elementB: {
          id: 'MEP-PIPE-02',
          name: 'Ground Drainage Line',
          category: 'IfcDuct',
          storey: 'Foundation'
        },
        intersectionDistance: 0.0,
        intersectionPoint: [-9, -0.2, -9],
        gridLocation: 'Grid 1-A',
        assignedTo: 'Pham Vu N (Civil)',
        createdDate: '2026-10-10',
        dueDate: '2026-10-18',
        notes: 'Resolved by rerouting drainage around footing eccentric zone.'
      }
    ]
  }
];

// Pre-configured structural quantity takeoff records
export function generateSampleQuantities(elements: BimElement[]): QuantityRow[] {
  return elements.map(el => ({
    elementId: el.id,
    mark: el.mark,
    storey: el.storey,
    category: el.category.replace('Ifc', 'Structural '),
    type: el.name.split(' (')[0],
    material: el.material,
    count: 1,
    length: el.dimensions.length,
    width: el.dimensions.width,
    height: el.dimensions.height,
    formworkArea: el.quantities.formworkArea,
    netVolume: el.quantities.netVolume,
    quantitySource: 'Native IFC Quantity',
    verificationStatus: 'Verified'
  }));
}

// Pre-configured BCF issues
export const sampleBcfIssues: BcfIssue[] = [
  {
    id: 'ISSUE-001',
    title: 'HVAC Duct clashes through Girder B400x700 on Level 02',
    status: 'In Progress',
    priority: 'Critical',
    discipline: 'Mechanical',
    assignee: 'Nguyen Van A (MEP Lead)',
    dueDate: '2026-10-25',
    viewpoint: {
      camera: {
        position: [2.5, 5.0, -1.0],
        target: [0, 3.4, -3],
        projection: 'Perspective'
      },
      selectedElementIds: ['BM-X-L2-2-2', 'MEP-DUCT-01']
    },
    comments: [
      {
        id: 'c1',
        author: 'Le Hoang K (BIM Manager)',
        avatar: 'LK',
        date: '2026-10-15 09:30',
        text: 'This girder is primary transfer framing. No sleeves larger than 150mm permitted in middle third span.'
      },
      {
        id: 'c2',
        author: 'Nguyen Van A (MEP)',
        avatar: 'NA',
        date: '2026-10-16 11:15',
        text: 'Understood. Reviewing alternate route below soffit with false ceiling coordinator.'
      }
    ]
  },
  {
    id: 'ISSUE-002',
    title: 'Fire protection main pipe penetrates Column COL-L1-2C',
    status: 'Open',
    priority: 'Critical',
    discipline: 'Plumbing',
    assignee: 'Tran Minh T (Plumbing)',
    dueDate: '2026-10-22',
    viewpoint: {
      camera: {
        position: [5.0, 4.0, 5.0],
        target: [3, 2.6, 3],
        projection: 'Perspective'
      },
      selectedElementIds: ['COL-L1-2C', 'MEP-PIPE-02']
    },
    comments: [
      {
        id: 'c3',
        author: 'Le Hoang K (BIM Manager)',
        avatar: 'LK',
        date: '2026-10-17 14:40',
        text: 'Immediate rerouting required before upcoming shop drawing freeze on Friday.'
      }
    ]
  }
];

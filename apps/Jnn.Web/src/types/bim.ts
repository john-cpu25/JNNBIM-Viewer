export type Discipline = 'Structural' | 'Architectural' | 'Mechanical' | 'Electrical' | 'Plumbing';

export type Workspace = 'home' | 'model' | 'section' | 'clash' | 'quantity' | 'reports' | 'import' | 'settings';

export type CameraPreset = 'Top' | 'Bottom' | 'Front' | 'Back' | 'Left' | 'Right' | 'Isometric';

export interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface StructuralDimensions {
  length: number;  // mm
  width: number;   // mm
  height: number;  // mm
  area: number;    // m2
  volume: number;  // m3
}

export interface BimElement {
  id: string;
  name: string;
  globalId: string;
  category: string; // e.g., 'IfcBeam', 'IfcColumn', 'IfcSlab', 'IfcWall', 'IfcFooting', 'IfcDuct'
  discipline: Discipline;
  storey: string;
  material: string;
  mark: string;
  dimensions: StructuralDimensions;
  properties: Record<string, Record<string, string | number>>;
  quantities: {
    netVolume: number;
    grossVolume: number;
    formworkArea: number;
    weight: number;
  };
  visible: boolean;
  isolated?: boolean;
  boundingBox: BoundingBox;
  color?: string;
  meshType: 'box' | 'cylinder' | 'slab';
  transform: {
    position: [number, number, number];
    rotation?: [number, number, number];
    scale: [number, number, number];
  };
}

export interface BimModel {
  id: string;
  name: string;
  revision: string;
  sourceFormat: 'IFC4' | 'IFC2X3' | 'RVT2025' | 'NWD';
  fileSize?: string;
  description?: string;
  units: {
    length: 'MILLIMETER';
    volume: 'CUBIC_METER';
  };
  elements: BimElement[];
}

export type ClashStatus = 'New' | 'Active' | 'Reviewed' | 'Approved' | 'Resolved';
export type ClashSeverity = 'Critical' | 'Major' | 'Minor';

export interface ClashResultItem {
  id: string;
  status: ClashStatus;
  severity: ClashSeverity;
  elementA: {
    id: string;
    name: string;
    category: string;
    storey: string;
  };
  elementB: {
    id: string;
    name: string;
    category: string;
    storey: string;
  };
  intersectionDistance: number; // mm
  intersectionPoint: [number, number, number];
  gridLocation: string;
  assignedTo: string;
  createdDate: string;
  dueDate: string;
  notes?: string;
}

export interface ClashTest {
  id: string;
  name: string;
  categoryA: string;
  categoryB: string;
  tolerance: number; // mm
  clashType: 'Hard Clash' | 'Clearance Violation';
  lastRunDate: string;
  results: ClashResultItem[];
}

export interface QuantityRow {
  elementId: string;
  mark: string;
  storey: string;
  category: string;
  type: string;
  material: string;
  count: number;
  length: number;
  width: number;
  height: number;
  formworkArea: number;
  netVolume: number;
  quantitySource: 'Native IFC Quantity' | 'Solid Calculus' | 'Mesh Approximation';
  verificationStatus: 'Verified' | 'Pending Calculation' | 'Manual Override';
}

export interface BcfComment {
  id: string;
  author: string;
  avatar: string;
  date: string;
  text: string;
}

export interface BcfIssue {
  id: string;
  title: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Critical' | 'High' | 'Normal';
  discipline: Discipline;
  assignee: string;
  dueDate: string;
  viewpoint: {
    camera: {
      position: [number, number, number];
      target: [number, number, number];
      projection: 'Perspective' | 'Orthographic';
    };
    snapshot?: string;
    selectedElementIds: string[];
  };
  comments: BcfComment[];
}

export interface SectionPlaneConfig {
  axis: 'x' | 'y' | 'z';
  enabled: boolean;
  offset: number;
  flipped: boolean;
}

export interface SectionBoxConfig {
  enabled: boolean;
  min: [number, number, number];
  max: [number, number, number];
}

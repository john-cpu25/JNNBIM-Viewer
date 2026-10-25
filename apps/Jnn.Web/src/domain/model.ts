/**
 * JNN common element contract (front-end mirror).
 *
 * Every source adapter (IFC via IfcOpenShell, APS/Revit, Navisworks) must map
 * its data into this shape. The canonical, language-neutral definition lives in
 * `contracts/schemas/jnn-element.schema.json`; keep the two in sync.
 */

export const JNN_SCHEMA_VERSION = '0.1.0';

export type SourceFormat = 'IFC' | 'RVT' | 'NWC' | 'NWD' | 'SAMPLE';

export type LengthUnit = 'mm' | 'm' | 'ft' | 'in';

export type GeometryStatus = 'ok' | 'missing' | 'failed' | 'simplified';

/** Column-major 4x4 matrix, identical layout to Three.js `Matrix4.elements`. */
export type Transform = readonly number[];

export type PropertyValue = string | number | boolean | null;

export interface PropertySet {
  name: string;
  properties: Record<string, PropertyValue>;
}

export interface QuantityValue {
  name: string;
  value: number;
  unit: string;
  /** `native` = read from the source model; `computed` = derived by JNN. */
  origin: 'native' | 'computed';
}

export interface ImportWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

/**
 * Pointer to geometry stored outside the metadata (binary chunk in a cache
 * bundle). Geometry is never embedded in metadata JSON.
 */
export interface MeshRef {
  bundleId: string;
  chunk: number;
  /** For the in-memory sample model the "chunk" is a procedural primitive. */
  primitive?: BoxPrimitive;
}

/** Oriented box: centre + size in model units, rotation about Z (radians). */
export interface BoxPrimitive {
  kind: 'box';
  center: readonly [number, number, number];
  size: readonly [number, number, number];
  rotationZ: number;
}

export interface JnnElement {
  modelId: string;
  modelRevisionId: string;
  sourceFormat: SourceFormat;
  sourceElementId: string;
  globalId: string | null;
  /** Unique within a revision; used as the key everywhere in the UI. */
  id: string;
  name: string;
  category: string;
  type: string;
  material: string | null;
  storey: string | null;
  transform: Transform;
  properties: PropertySet[];
  quantities: QuantityValue[];
  meshRefs: MeshRef[];
  geometryStatus: GeometryStatus;
  importWarnings: ImportWarning[];
}

export interface Storey {
  id: string;
  name: string;
  elevation: number;
}

export interface JnnModel {
  schemaVersion: string;
  modelId: string;
  modelRevisionId: string;
  name: string;
  projectName: string;
  siteName: string;
  buildingName: string;
  sourceFormat: SourceFormat;
  units: LengthUnit;
  /** +Z up, right-handed — same as IFC. The viewer converts to Three's +Y up. */
  upAxis: 'Z';
  storeys: Storey[];
  elements: JnnElement[];
}

export const IDENTITY_TRANSFORM: Transform = Object.freeze([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);

export function indexElements(model: JnnModel): Map<string, JnnElement> {
  return new Map(model.elements.map((e) => [e.id, e]));
}

export function getQuantity(el: JnnElement, name: string): QuantityValue | undefined {
  return el.quantities.find((q) => q.name === name);
}

/** Short human mark (Revit "Mark" / IFC Tag) if the adapter provided one. */
export function elementMark(el: JnnElement): string | null {
  for (const ps of el.properties) {
    const v = ps.properties['Mark'] ?? ps.properties['Tag'];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return null;
}

/** Label for lists: the distinguishing mark first, then the type. */
export function elementLabel(el: JnnElement): string {
  const mark = elementMark(el);
  return mark ? `${mark} · ${el.type}` : el.name;
}

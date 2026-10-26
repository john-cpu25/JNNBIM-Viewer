/**
 * mapToJnn.ts — Maps That Open fragments / IFC data to JNN domain models (JnnModel, JnnElement, PropertySet).
 *
 * Requirements (T05):
 * - id = ${modelId}:${localId}, globalId (IFC GUID), sourceFormat: 'IFC', sourceElementId = localId (string).
 * - category = IFC class name (e.g. IfcWall, IfcBeam). English display table provided for common classes.
 * - type = type name (from IfcTypeObject / ObjectType / Tag).
 * - material = material name if available.
 * - storey = storey name via spatial containment.
 * - properties = all Psets (Pset name -> key/value pairs).
 * - quantities = Qto BaseQuantities with origin: 'native' and appropriate units.
 * - elements without geometry: geometryStatus: 'missing'.
 */
import {
  IDENTITY_TRANSFORM,
  JNN_SCHEMA_VERSION,
  type GeometryStatus,
  type JnnElement,
  type JnnModel,
  type PropertySet,
  type PropertyValue,
  type QuantityValue,
  type Storey,
} from '../domain/model';

export interface SpatialNode {
  category?: string | null;
  localId?: number | null;
  children?: SpatialNode[];
}

export interface IfcMetadataRaw {
  schema?: string;
  names?: string[];
  descriptions?: string[];
  generator?: string;
  version?: string;
}

/** Mapping of IFC UPPERCASE class names to canonical PascalCase IFC class names */
const IFC_CLASS_MAP: Record<string, string> = {
  IFCWALL: 'IfcWall',
  IFCWALLSTANDARDCASE: 'IfcWallStandardCase',
  IFCSLAB: 'IfcSlab',
  IFCROOF: 'IfcRoof',
  IFCCOLUMN: 'IfcColumn',
  IFCBEAM: 'IfcBeam',
  IFCWINDOW: 'IfcWindow',
  IFCDOOR: 'IfcDoor',
  IFCSTAIR: 'IfcStair',
  IFCSTAIRFLIGHT: 'IfcStairFlight',
  IFCRAILING: 'IfcRailing',
  IFCMEMBER: 'IfcMember',
  IFCPLATE: 'IfcPlate',
  IFCFOOTING: 'IfcFooting',
  IFCSPACE: 'IfcSpace',
  IFCFURNISHINGELEMENT: 'IfcFurnishingElement',
  IFCBUILDINGELEMENTPROXY: 'IfcBuildingElementProxy',
  IFCDUCTSEGMENT: 'IfcDuctSegment',
  IFCPIPESEGMENT: 'IfcPipeSegment',
  IFCFLOWTERMINAL: 'IfcFlowTerminal',
  IFCDISTRIBUTIONELEMENT: 'IfcDistributionElement',
  IFCBUILDINGSTOREY: 'IfcBuildingStorey',
  IFCBUILDING: 'IfcBuilding',
  IFCSITE: 'IfcSite',
  IFCPROJECT: 'IfcProject',
};

/** English display category names for common IFC classes */
export const IFC_ENGLISH_CATEGORIES: Record<string, string> = {
  IfcWall: 'Walls',
  IfcWallStandardCase: 'Walls',
  IfcSlab: 'Slabs',
  IfcRoof: 'Roofs',
  IfcColumn: 'Columns',
  IfcBeam: 'Beams',
  IfcWindow: 'Windows',
  IfcDoor: 'Doors',
  IfcStair: 'Stairs',
  IfcStairFlight: 'Stairs',
  IfcRailing: 'Railings',
  IfcMember: 'Members',
  IfcPlate: 'Plates',
  IfcFooting: 'Footings',
  IfcSpace: 'Spaces',
  IfcFurnishingElement: 'Furniture',
  IfcBuildingElementProxy: 'Generic Models',
  IfcDuctSegment: 'Ducts',
  IfcPipeSegment: 'Pipes',
  IfcFlowTerminal: 'Fixtures',
  IfcDistributionElement: 'MEP Elements',
};

/** Convert raw IFC category (e.g. IFCWALL) to canonical PascalCase (IfcWall) */
export function toIfcClassName(rawCategory: string | null | undefined): string {
  if (!rawCategory) return 'IfcProduct';
  const upper = rawCategory.toUpperCase();
  if (IFC_CLASS_MAP[upper]) return IFC_CLASS_MAP[upper];
  if (upper.startsWith('IFC')) {
    const rest = upper.slice(3);
    return 'Ifc' + rest.charAt(0) + rest.slice(1).toLowerCase();
  }
  return rawCategory;
}

/** Get English display name for an IFC class */
export function toEnglishCategory(ifcClass: string): string {
  return IFC_ENGLISH_CATEGORIES[ifcClass] ?? ifcClass.replace(/^Ifc/, '');
}

export interface ParsedSpatialResult {
  projectLocalId: number | null;
  siteLocalId: number | null;
  buildingLocalId: number | null;
  storeyLocalIds: number[];
  elementStoreyMap: Map<number, string>;
  allElementLocalIds: number[];
}

/** Parse That Open spatial structure tree into structured relations */
export function parseSpatialStructure(root: SpatialNode): ParsedSpatialResult {
  let projectLocalId: number | null = null;
  let siteLocalId: number | null = null;
  let buildingLocalId: number | null = null;
  const storeyLocalIds: number[] = [];
  const elementStoreyMap = new Map<number, string>();
  const allElementLocalIds = new Set<number>();

  const traverse = (node: SpatialNode, currentStorey: string | null) => {
    let nextStorey = currentStorey;

    if (node.category === 'IFCPROJECT' && node.children) {
      for (const child of node.children) {
        if (child.localId) projectLocalId = child.localId;
        traverse(child, nextStorey);
      }
      return;
    }

    if (node.category === 'IFCSITE' && node.children) {
      for (const child of node.children) {
        if (child.localId) siteLocalId = child.localId;
        traverse(child, nextStorey);
      }
      return;
    }

    if (node.category === 'IFCBUILDING' && node.children) {
      for (const child of node.children) {
        if (child.localId) buildingLocalId = child.localId;
        traverse(child, nextStorey);
      }
      return;
    }

    if (node.category === 'IFCBUILDINGSTOREY' && node.children) {
      for (const child of node.children) {
        if (child.localId) {
          storeyLocalIds.push(child.localId);
          nextStorey = `Storey #${child.localId}`;
        }
        traverse(child, nextStorey);
      }
      return;
    }

    // Leaf elements or sub-group categories (e.g. IFCWALL, IFCSLAB, IFCSPACE, IFCROOF)
    if (node.localId && !node.children) {
      allElementLocalIds.add(node.localId);
      elementStoreyMap.set(node.localId, currentStorey ?? '(Unassigned)');
    }

    if (node.children) {
      // If node represents an intermediate element with children (e.g. IFCROOF with slab children)
      if (node.localId) {
        allElementLocalIds.add(node.localId);
        elementStoreyMap.set(node.localId, currentStorey ?? '(Unassigned)');
      }
      for (const child of node.children) {
        traverse(child, nextStorey);
      }
    }
  };

  traverse(root, null);

  return {
    projectLocalId,
    siteLocalId,
    buildingLocalId,
    storeyLocalIds,
    elementStoreyMap,
    allElementLocalIds: [...allElementLocalIds],
  };
}

export interface MapIfcOptions {
  modelId: string;
  filename: string;
  metadata?: IfcMetadataRaw;
  spatialRoot?: SpatialNode;
  spatialHeadersData?: any[];
  itemsBasicData: any[];
  geometryLocalIds?: Set<number>;
  fileSize?: number;
}

/** Map IFC fragments metadata to lightweight JnnModel */
export function mapIfcToJnnModel(options: MapIfcOptions): JnnModel {
  const {
    modelId,
    filename,
    metadata,
    spatialRoot,
    spatialHeadersData = [],
    itemsBasicData = [],
    geometryLocalIds = new Set<number>(),
    fileSize,
  } = options;

  let projectName = 'IFC Project';
  let siteName = 'Default Site';
  let buildingName = 'Default Building';
  const storeys: Storey[] = [];
  const storeyNameById = new Map<number, string>();

  // Extract names from spatial header data
  for (const item of spatialHeadersData) {
    const cat = item._category?.value;
    const localId = item._localId?.value;
    const name = item.Name?.value;
    if (cat === 'IFCPROJECT' && name) projectName = name;
    if (cat === 'IFCSITE' && name) siteName = name;
    if (cat === 'IFCBUILDING' && name) buildingName = name;
    if (cat === 'IFCBUILDINGSTOREY') {
      const elevation = typeof item.Elevation?.value === 'number' ? item.Elevation.value : 0;
      const sName = name || `Storey #${localId}`;
      storeys.push({
        id: String(localId),
        name: sName,
        elevation,
      });
      if (localId !== undefined) {
        storeyNameById.set(localId, sName);
      }
    }
  }

  let elementStoreyMap = new Map<number, string>();
  if (spatialRoot) {
    const parsed = parseSpatialStructure(spatialRoot);
    // Update storey names from the real storey definitions
    for (const [elId, rawStorey] of parsed.elementStoreyMap) {
      const match = rawStorey.match(/^Storey #(\d+)$/);
      if (match) {
        const sId = Number(match[1]);
        elementStoreyMap.set(elId, storeyNameById.get(sId) ?? rawStorey);
      } else {
        elementStoreyMap.set(elId, rawStorey);
      }
    }
  }

  // Sort storeys by elevation ascending
  storeys.sort((a, b) => a.elevation - b.elevation);

  // If no storeys found in file, add default
  if (storeys.length === 0) {
    storeys.push({ id: 'ground', name: 'Ground Floor', elevation: 0 });
  }

  const elements: JnnElement[] = [];

  for (const item of itemsBasicData) {
    const localId = item._localId?.value;
    if (localId === undefined || localId === null) continue;

    const rawCategory = item._category?.value;
    const ifcClass = toIfcClassName(rawCategory);
    const globalId = item._guid?.value ?? null;
    const name = item.Name?.value || `${ifcClass} #${localId}`;
    const type = item.ObjectType?.value || item.Tag?.value || ifcClass;
    const storey = elementStoreyMap.get(localId) ?? storeys[0]?.name ?? '(Unassigned)';
    const hasGeometry = geometryLocalIds.size === 0 || geometryLocalIds.has(localId);
    const geometryStatus: GeometryStatus = hasGeometry ? 'ok' : 'missing';

    elements.push({
      modelId,
      modelRevisionId: 'rev-001',
      sourceFormat: 'IFC',
      sourceElementId: String(localId),
      globalId,
      id: `${modelId}:${localId}`,
      name,
      category: ifcClass,
      type,
      material: null,
      storey,
      transform: IDENTITY_TRANSFORM,
      properties: [],
      quantities: [],
      meshRefs: [],
      geometryStatus,
      importWarnings: [],
    });
  }

  const appName = metadata?.names?.[4] || metadata?.names?.[5] || '';
  const schemaStr = metadata?.schema || 'IFC';

  return {
    schemaVersion: JNN_SCHEMA_VERSION,
    modelId,
    modelRevisionId: 'rev-001',
    name: filename,
    projectName,
    siteName,
    buildingName,
    sourceFormat: 'IFC',
    units: 'm',
    upAxis: 'Z',
    storeys,
    elements,
    application: appName,
    fileSize,
    ifcSchema: schemaStr,
  };
}

export interface ItemPropertiesResult {
  properties: PropertySet[];
  quantities: QuantityValue[];
  type?: string;
  material?: string;
}

/** Parse full item data (including IsDefinedBy relations) into PropertySets and Quantities */
export function parseItemPropertiesAndQuantities(itemData: any): ItemPropertiesResult {
  const propertySets: PropertySet[] = [];
  const quantities: QuantityValue[] = [];
  let type: string | undefined;
  let material: string | undefined;

  if (!itemData) {
    return { properties: propertySets, quantities };
  }

  // 1. Identity attributes as standard Pset
  const identityProps: Record<string, PropertyValue> = {};
  if (itemData._guid?.value) identityProps['GlobalId'] = itemData._guid.value;
  if (itemData.Tag?.value) identityProps['Tag'] = itemData.Tag.value;
  if (itemData.ObjectType?.value) identityProps['ObjectType'] = itemData.ObjectType.value;
  if (itemData.Description?.value) identityProps['Description'] = itemData.Description.value;
  if (itemData._category?.value) identityProps['IFC Class'] = toIfcClassName(itemData._category.value);

  if (Object.keys(identityProps).length > 0) {
    propertySets.push({
      name: 'IFC Attributes',
      properties: identityProps,
    });
  }

  // 2. Relations (IsDefinedBy)
  const isDefinedBy = itemData.IsDefinedBy;
  if (Array.isArray(isDefinedBy)) {
    for (const rel of isDefinedBy) {
      if (!rel || typeof rel !== 'object') continue;
      const cat = rel._category?.value?.toUpperCase();

      // Property Sets
      if (cat === 'IFCPROPERTYSET') {
        const psetName = rel.Name?.value || 'Pset_Custom';
        const psetProps: Record<string, PropertyValue> = {};

        const propsList = rel.HasProperties;
        if (Array.isArray(propsList)) {
          for (const prop of propsList) {
            const propName = prop?.Name?.value;
            if (!propName) continue;
            const nominal = prop.NominalValue;
            let val: PropertyValue = null;
            if (nominal && typeof nominal === 'object' && 'value' in nominal) {
              val = nominal.value as PropertyValue;
            } else if (nominal !== undefined) {
              val = nominal as PropertyValue;
            }
            psetProps[propName] = val;
          }
        }

        if (Object.keys(psetProps).length > 0) {
          propertySets.push({
            name: psetName,
            properties: psetProps,
          });
        }
      }

      // Element Quantities (BaseQuantities)
      if (cat === 'IFCELEMENTQUANTITY') {
        const qtoList = rel.Quantities;
        if (Array.isArray(qtoList)) {
          for (const q of qtoList) {
            const qName = q?.Name?.value;
            if (!qName) continue;

            let val: number | undefined;
            let unit = 'm';

            if (typeof q.LengthValue?.value === 'number') {
              val = q.LengthValue.value;
              unit = 'm';
            } else if (typeof q.AreaValue?.value === 'number') {
              val = q.AreaValue.value;
              unit = 'm²';
            } else if (typeof q.VolumeValue?.value === 'number') {
              val = q.VolumeValue.value;
              unit = 'm³';
            } else if (typeof q.CountValue?.value === 'number') {
              val = q.CountValue.value;
              unit = 'pcs';
            } else if (typeof q.WeightValue?.value === 'number') {
              val = q.WeightValue.value;
              unit = 'kg';
            }

            if (val !== undefined) {
              quantities.push({
                name: qName,
                value: Math.round(val * 1000) / 1000,
                unit,
                origin: 'native',
              });
            }
          }
        }
      }

      // Element Type
      if (cat && cat.endsWith('TYPE')) {
        type = rel.Name?.value || rel.ElementType?.value || rel.Tag?.value;
      }

      // Material
      if (cat === 'IFCMATERIAL') {
        material = rel.Name?.value;
      }
    }
  }

  return { properties: propertySets, quantities, type, material };
}

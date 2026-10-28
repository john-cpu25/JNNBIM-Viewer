import type { RuleDefinition, RuleViolation } from './types';
import { elementBounds, isEmpty } from '../domain/bounds';

/**
 * Mapping of IFC classes to their required BIM properties.
 */
export const REQUIRED_PROPERTIES_MAP: Record<string, string[]> = {
  IfcWall: ['Width'],
  IfcWallStandardCase: ['Width'],
  IfcSlab: ['Thickness'],
  IfcColumn: ['Width', 'Depth'],
  IfcBeam: ['Width', 'Depth'],
};

/**
 * Helper to normalize IFC class names (e.g. 'wall' -> 'IfcWall', 'IfcWall' -> 'IfcWall').
 */
function normalizeIfcClass(category: string): string {
  const trimmed = (category || '').trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase().startsWith('ifc')) {
    return 'Ifc' + trimmed.slice(3);
  }
  return 'Ifc' + trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Quy tắc 1 — R-GEO-01: Phần tử không có hình học hiển thị
 */
export const ruleMissingGeometry: RuleDefinition = {
  id: 'R-GEO-01',
  name: 'Phần tử thiếu hình học 3D',
  nameEn: 'Missing 3D Geometry',
  description: 'Kiểm tra các phần tử không có hình học hiển thị, kích thước bounding box bằng 0 hoặc trạng thái hình học lỗi.',
  category: 'Geometry',
  severity: 'Error',
  check: async (ctx) => {
    const violations: RuleViolation[] = [];

    for (const el of ctx.elements) {
      const bounds = elementBounds(el);
      const isBoxEmpty = isEmpty(bounds);
      const isPointBox =
        !isBoxEmpty &&
        bounds.min[0] === bounds.max[0] &&
        bounds.min[1] === bounds.max[1] &&
        bounds.min[2] === bounds.max[2];

      const isStatusMissing = el.geometryStatus === 'missing' || el.geometryStatus === 'failed';
      const hasNoMesh = el.meshRefs.length === 0;

      if (isStatusMissing || isBoxEmpty || isPointBox || hasNoMesh) {
        violations.push({
          ruleId: 'R-GEO-01',
          severity: 'Error',
          elementId: el.id,
          elementName: el.name || el.id,
          globalId: el.globalId || undefined,
          modelId: el.modelId,
          message: `Phần tử '${el.name || el.id}' (${el.globalId || el.id}) không có hình học hiển thị`,
          messageEn: `Element '${el.name || el.id}' (${el.globalId || el.id}) has no visible geometry`,
        });
      }
    }

    return violations;
  },
};

/**
 * Quy tắc 2 — R-SPA-01: Phần tử không thuộc tầng nào
 */
export const ruleUnassignedStorey: RuleDefinition = {
  id: 'R-SPA-01',
  name: 'Phần tử không thuộc tầng nào',
  nameEn: 'Element Not Assigned to Any Storey',
  description: 'Phát hiện các phần tử chưa được phân bổ vào tầng (IfcBuildingStorey) trong cây cấu trúc không gian.',
  category: 'Spatial',
  severity: 'Warning',
  check: async (ctx) => {
    const violations: RuleViolation[] = [];

    for (const el of ctx.elements) {
      const s = el.storey;
      const isUnassigned =
        s === null ||
        s === undefined ||
        s.trim() === '' ||
        s.toLowerCase() === 'none' ||
        s.toLowerCase() === 'unassigned';

      if (isUnassigned) {
        violations.push({
          ruleId: 'R-SPA-01',
          severity: 'Warning',
          elementId: el.id,
          elementName: el.name || el.id,
          globalId: el.globalId || undefined,
          modelId: el.modelId,
          message: `Phần tử '${el.name || el.id}' (${el.globalId || el.id}) không được gán vào tầng nào`,
          messageEn: `Element '${el.name || el.id}' (${el.globalId || el.id}) is not assigned to any storey`,
        });
      }
    }

    return violations;
  },
};

/**
 * Quy tắc 3 — R-NAM-01: Phần tử đặt tên mặc định
 */
export const ruleDefaultNaming: RuleDefinition = {
  id: 'R-NAM-01',
  name: 'Phần tử đặt tên mặc định',
  nameEn: 'Default Element Naming',
  description: 'Cảnh báo các cấu kiện dùng tên mặc định của phần mềm (Generic, Default, Unnamed, Copy) chưa được đặt tên rõ ràng.',
  category: 'Naming',
  severity: 'Warning',
  check: async (ctx) => {
    const violations: RuleViolation[] = [];
    const defaultPattern = /^(generic|default|unnamed|copy|mô hình mặc định|chưa đặt tên|wall:generic|floor:floor)/i;

    for (const el of ctx.elements) {
      const name = (el.name || '').trim();
      const isDefault = !name || defaultPattern.test(name);

      if (isDefault) {
        violations.push({
          ruleId: 'R-NAM-01',
          severity: 'Warning',
          elementId: el.id,
          elementName: el.name || el.id,
          globalId: el.globalId || undefined,
          modelId: el.modelId,
          message: `Phần tử '${el.name || el.id}' (${el.globalId || el.id}) có tên mặc định, nên đặt tên rõ ràng`,
          messageEn: `Element '${el.name || el.id}' (${el.globalId || el.id}) has a default name, please rename clearly`,
        });
      }
    }

    return violations;
  },
};

/**
 * Quy tắc 4 — R-PROP-01: Thiếu thuộc tính bắt buộc
 */
export const ruleMissingRequiredProperty: RuleDefinition = {
  id: 'R-PROP-01',
  name: 'Thiếu thuộc tính BIM bắt buộc',
  nameEn: 'Missing Required BIM Properties',
  description: 'Kiểm tra các thuộc tính BIM cơ bản: IfcWall phải có Width, IfcSlab phải có Thickness, IfcColumn & IfcBeam phải có Width và Depth.',
  category: 'Property',
  severity: 'Warning',
  check: async (ctx) => {
    const violations: RuleViolation[] = [];

    for (const el of ctx.elements) {
      const ifcClass = normalizeIfcClass(el.category);
      const requiredProps = REQUIRED_PROPERTIES_MAP[ifcClass];
      if (!requiredProps || requiredProps.length === 0) continue;

      // Extract existing property names from element or via getProperties
      let propSets = el.properties;
      if (!propSets || propSets.length === 0) {
        try {
          propSets = await ctx.getProperties(el.id);
        } catch {
          propSets = [];
        }
      }

      const existingPropNames = new Set<string>();
      for (const pset of propSets) {
        for (const pName of Object.keys(pset.properties)) {
          existingPropNames.add(pName.toLowerCase());
        }
      }

      for (const req of requiredProps) {
        if (!existingPropNames.has(req.toLowerCase())) {
          violations.push({
            ruleId: 'R-PROP-01',
            severity: 'Warning',
            elementId: el.id,
            elementName: el.name || el.id,
            globalId: el.globalId || undefined,
            modelId: el.modelId,
            message: `Phần tử '${el.name || el.id}' (${ifcClass}) thiếu thuộc tính '${req}'`,
            messageEn: `Element '${el.name || el.id}' (${ifcClass}) is missing required property '${req}'`,
          });
        }
      }
    }

    return violations;
  },
};

/**
 * Quy tắc 5 — R-DUP-01: Phần tử trùng lặp hình học (dùng clash results)
 */
export const ruleDuplicateElements: RuleDefinition = {
  id: 'R-DUP-01',
  name: 'Phần tử trùng lặp hình học',
  nameEn: 'Duplicate Geometry Elements',
  description: 'Phát hiện các phần tử bị vẽ trùng khít lên nhau thông qua kết quả va chạm loại Duplicates.',
  category: 'Clash',
  severity: 'Error',
  check: async (ctx) => {
    const violations: RuleViolation[] = [];
    if (!ctx.clashResults || ctx.clashResults.length === 0) {
      return violations;
    }

    for (const clash of ctx.clashResults) {
      if (clash.type !== 'Duplicates') continue;

      const nameA = ('aName' in clash && clash.aName) || String(clash.aId);
      const nameB = ('bName' in clash && clash.bName) || String(clash.bId);
      const guidA = ('aGuid' in clash && clash.aGuid) || String(clash.aId);
      const dist = clash.distance !== undefined ? clash.distance.toFixed(3) : '0.000';

      violations.push({
        ruleId: 'R-DUP-01',
        severity: 'Error',
        elementId: String(clash.aId),
        elementName: nameA,
        globalId: guidA,
        modelId: '',
        message: `Phần tử '${nameA}' trùng lặp với '${nameB}' (khoảng cách ${dist}m)`,
        messageEn: `Element '${nameA}' duplicates '${nameB}' (distance ${dist}m)`,
      });
    }

    return violations;
  },
};

/**
 * Built-in rules array registered by default in JNN BIM Viewer.
 */
export const BUILTIN_RULES: RuleDefinition[] = [
  ruleMissingGeometry,
  ruleUnassignedStorey,
  ruleDefaultNaming,
  ruleMissingRequiredProperty,
  ruleDuplicateElements,
];

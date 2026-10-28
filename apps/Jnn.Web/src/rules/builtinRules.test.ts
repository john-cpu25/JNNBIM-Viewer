import { describe, it, expect } from 'vitest';
import {
  BUILTIN_RULES,
  ruleMissingGeometry,
  ruleUnassignedStorey,
  ruleDefaultNaming,
  ruleMissingRequiredProperty,
  ruleDuplicateElements,
} from './builtinRules';
import type { JnnElement, PropertySet } from '../domain/model';
import type { RuleContext } from './types';
import type { ClashRecord } from '../clash/clashResults';

function createMockElement(partial?: Partial<JnnElement>): JnnElement {
  return {
    id: 'el-default-1',
    name: 'Tường BTCT 200',
    category: 'IfcWall',
    type: 'Wall',
    modelId: 'm1',
    modelRevisionId: 'rev-1',
    sourceFormat: 'IFC',
    sourceElementId: 'src-1',
    globalId: 'guid-default-1',
    material: 'Concrete',
    storey: 'Tầng 1',
    transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    properties: [
      {
        name: 'Dimensions',
        properties: {
          Width: 0.2,
          Length: 5.0,
          Height: 3.0,
        },
      },
    ],
    quantities: [],
    meshRefs: [
      {
        bundleId: 'b1',
        chunk: 0,
        primitive: {
          kind: 'box',
          center: [0, 0, 1.5],
          size: [0.2, 5.0, 3.0],
          rotationZ: 0,
        },
      },
    ],
    geometryStatus: 'ok',
    importWarnings: [],
    ...partial,
  };
}

describe('Built-in Rules (T17.2)', () => {
  it('registers all 5 builtin rules in BUILTIN_RULES array', () => {
    expect(BUILTIN_RULES).toHaveLength(5);
    const ruleIds = BUILTIN_RULES.map((r) => r.id);
    expect(ruleIds).toEqual([
      'R-GEO-01',
      'R-SPA-01',
      'R-NAM-01',
      'R-PROP-01',
      'R-DUP-01',
    ]);
  });

  describe('R-GEO-01: Missing Geometry', () => {
    it('flags element with missing geometry status or empty bounds', async () => {
      const validElement = createMockElement({ id: 'valid-1' });
      const missingStatusElement = createMockElement({
        id: 'bad-1',
        name: 'Tường không mesh',
        geometryStatus: 'missing',
        meshRefs: [],
      });
      const zeroBoundsElement = createMockElement({
        id: 'bad-2',
        name: 'Point Wall',
        meshRefs: [
          {
            bundleId: 'b1',
            chunk: 0,
            primitive: {
              kind: 'box',
              center: [0, 0, 0],
              size: [0, 0, 0],
              rotationZ: 0,
            },
          },
        ],
      });

      const ctx: RuleContext = {
        models: [],
        elements: [validElement, missingStatusElement, zeroBoundsElement],
        getProperties: async () => [],
      };

      const violations = await ruleMissingGeometry.check(ctx);
      expect(violations).toHaveLength(2);
      expect(violations.map((v) => v.elementId)).toEqual(['bad-1', 'bad-2']);
      expect(violations[0]!.severity).toBe('Error');
      expect(violations[0]!.message).toContain('không có hình học hiển thị');
    });

    it('returns 0 violations when all elements have valid geometries', async () => {
      const validElement = createMockElement();
      const ctx: RuleContext = {
        models: [],
        elements: [validElement],
        getProperties: async () => [],
      };

      const violations = await ruleMissingGeometry.check(ctx);
      expect(violations).toHaveLength(0);
    });
  });

  describe('R-SPA-01: Element Not Assigned to Any Storey', () => {
    it('flags elements with null, undefined, or empty storey', async () => {
      const validElement = createMockElement({ id: 'el-ok', storey: 'Tầng 1' });
      const noStorey1 = createMockElement({ id: 'el-bad-1', storey: null });
      const noStorey2 = createMockElement({ id: 'el-bad-2', storey: '   ' });
      const noStorey3 = createMockElement({ id: 'el-bad-3', storey: 'None' });

      const ctx: RuleContext = {
        models: [],
        elements: [validElement, noStorey1, noStorey2, noStorey3],
        getProperties: async () => [],
      };

      const violations = await ruleUnassignedStorey.check(ctx);
      expect(violations).toHaveLength(3);
      expect(violations.map((v) => v.elementId)).toEqual(['el-bad-1', 'el-bad-2', 'el-bad-3']);
      expect(violations[0]!.severity).toBe('Warning');
      expect(violations[0]!.message).toContain('không được gán vào tầng nào');
    });
  });

  describe('R-NAM-01: Default Element Naming', () => {
    it('flags elements with default, generic, unnamed, or copy patterns', async () => {
      const validWall = createMockElement({ id: 'el-ok', name: 'Tường bê tông cốt thép 200' });
      const genericWall = createMockElement({ id: 'el-bad-1', name: 'Generic Wall 200' });
      const defaultFloor = createMockElement({ id: 'el-bad-2', name: 'Default Floor' });
      const unnamed = createMockElement({ id: 'el-bad-3', name: 'Unnamed element' });
      const copyWall = createMockElement({ id: 'el-bad-4', name: 'Copy of Column' });

      const ctx: RuleContext = {
        models: [],
        elements: [validWall, genericWall, defaultFloor, unnamed, copyWall],
        getProperties: async () => [],
      };

      const violations = await ruleDefaultNaming.check(ctx);
      expect(violations).toHaveLength(4);
      expect(violations[0]!.severity).toBe('Warning');
      expect(violations[0]!.message).toContain('có tên mặc định, nên đặt tên rõ ràng');
    });

    it('returns 0 violations for properly named elements', async () => {
      const validWall = createMockElement({ name: 'Vách thang máy V1' });
      const ctx: RuleContext = {
        models: [],
        elements: [validWall],
        getProperties: async () => [],
      };

      const violations = await ruleDefaultNaming.check(ctx);
      expect(violations).toHaveLength(0);
    });
  });

  describe('R-PROP-01: Missing Required Properties', () => {
    it('flags IfcWall missing Width property', async () => {
      const wallWithWidth = createMockElement({
        id: 'wall-ok',
        category: 'IfcWall',
        properties: [{ name: 'Dim', properties: { Width: 200 } }],
      });
      const wallMissingWidth = createMockElement({
        id: 'wall-bad',
        name: 'Vách V2',
        category: 'IfcWall',
        properties: [{ name: 'Dim', properties: { Height: 3000 } }],
      });

      const ctx: RuleContext = {
        models: [],
        elements: [wallWithWidth, wallMissingWidth],
        getProperties: async () => [],
      };

      const violations = await ruleMissingRequiredProperty.check(ctx);
      expect(violations).toHaveLength(1);
      expect(violations[0]!.elementId).toBe('wall-bad');
      expect(violations[0]!.message).toContain("thiếu thuộc tính 'Width'");
    });

    it('flags IfcSlab missing Thickness and IfcColumn missing Depth', async () => {
      const slabMissingThickness = createMockElement({
        id: 'slab-1',
        name: 'Sàn tầng 2',
        category: 'IfcSlab',
        properties: [{ name: 'Props', properties: { Area: 50 } }],
      });
      const columnMissingDepth = createMockElement({
        id: 'col-1',
        name: 'Cột C1',
        category: 'IfcColumn',
        properties: [{ name: 'Props', properties: { Width: 0.4 } }], // missing Depth
      });

      const ctx: RuleContext = {
        models: [],
        elements: [slabMissingThickness, columnMissingDepth],
        getProperties: async () => [],
      };

      const violations = await ruleMissingRequiredProperty.check(ctx);
      expect(violations).toHaveLength(2);
      expect(violations[0]!.elementId).toBe('slab-1');
      expect(violations[0]!.message).toContain("thiếu thuộc tính 'Thickness'");
      expect(violations[1]!.elementId).toBe('col-1');
      expect(violations[1]!.message).toContain("thiếu thuộc tính 'Depth'");
    });

    it('fetches properties via getProperties fallback if element.properties is empty', async () => {
      const wallNoCachedProps = createMockElement({
        id: 'wall-async',
        category: 'IfcWall',
        properties: [],
      });

      const asyncPropsMock = async (id: string): Promise<PropertySet[]> => {
        if (id === 'wall-async') {
          return [{ name: 'Dimensions', properties: { Width: 0.25 } }];
        }
        return [];
      };

      const ctx: RuleContext = {
        models: [],
        elements: [wallNoCachedProps],
        getProperties: asyncPropsMock,
      };

      const violations = await ruleMissingRequiredProperty.check(ctx);
      expect(violations).toHaveLength(0);
    });
  });

  describe('R-DUP-01: Duplicate Elements', () => {
    it('generates violations for each clash result of type Duplicates', async () => {
      const mockClashes: ClashRecord[] = [
        {
          clashId: 'c1',
          testId: 't1',
          name: 'Clash 1',
          status: 'Active',
          type: 'Duplicates',
          distance: 0.0,
          aId: 'el-dup-1',
          bId: 'el-dup-2',
          aName: 'Sàn S1',
          bName: 'Sàn S1 (Copy)',
          point: [0, 0, 0],
          firstFoundAt: 1000,
          lastFoundAt: 1000,
        },
        {
          clashId: 'c2',
          testId: 't1',
          name: 'Clash 2',
          status: 'Active',
          type: 'Hard',
          distance: 0.0,
          aId: 'el-beam-1',
          bId: 'el-col-1',
          aName: 'Dầm B1',
          bName: 'Cột C1',
          point: [0, 0, 0],
          firstFoundAt: 1000,
          lastFoundAt: 1000,
        },
      ];

      const ctx: RuleContext = {
        models: [],
        elements: [],
        getProperties: async () => [],
        clashResults: mockClashes,
      };

      const violations = await ruleDuplicateElements.check(ctx);
      expect(violations).toHaveLength(1);
      expect(violations[0]!.elementId).toBe('el-dup-1');
      expect(violations[0]!.severity).toBe('Error');
      expect(violations[0]!.message).toContain("trùng lặp với 'Sàn S1 (Copy)'");
    });

    it('returns 0 violations when no clashResults exist or no Duplicates present', async () => {
      const ctx: RuleContext = {
        models: [],
        elements: [],
        getProperties: async () => [],
        clashResults: [],
      };

      const violations = await ruleDuplicateElements.check(ctx);
      expect(violations).toHaveLength(0);
    });
  });
});

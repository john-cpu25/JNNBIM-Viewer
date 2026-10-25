import { createSampleModel } from './sampleModel';
import { indexElements } from './model';
import { allBranchIds, ancestorIds, buildCategoryTree, buildSpatialTree, defaultExpanded, elementNodeId, filterTree, flattenTree } from './tree';

const model = createSampleModel();
const byId = indexElements(model);

describe('spatial tree', () => {
  const t = buildSpatialTree(model);
  it('contains every element exactly once', () => {
    expect(t.elementIds).toHaveLength(model.elements.length);
    expect(new Set(t.elementIds).size).toBe(model.elements.length);
  });
  it('orders storeys by elevation', () => {
    const building = t.children[0]!.children[0]!;
    expect(building.children.map((c) => c.label)).toEqual(['Level 1 (Ground)', 'Level 2', 'Level 3', 'Roof']);
  });
  it('finds ancestors for reveal', () => {
    const el = model.elements.find((e) => e.storey === 'Level 2' && e.category === 'Pipes')!;
    const anc = ancestorIds(t, el.id);
    expect(anc[0]).toBe('project');
    expect(anc.at(-1)).toContain('cat:Pipes');
  });
  it('flattens only expanded branches', () => {
    const rows = flattenTree(t, defaultExpanded(t), false);
    expect(rows.map((r) => r.node.kind)).toEqual(['site', 'building', 'storey', 'storey', 'storey', 'storey']);
  });
});

describe('category tree', () => {
  it('groups by category then type', () => {
    const t = buildCategoryTree(model);
    const walls = t.children.find((c) => c.label === 'Walls')!;
    expect(walls.children.map((c) => c.label)).toContain('Basic Wall: Core RC 200mm');
    expect(walls.elementIds.length).toBe(model.elements.filter((e) => e.category === 'Walls').length);
  });
});

describe('filterTree', () => {
  const t = buildSpatialTree(model);
  it('matches all terms case-insensitively', () => {
    expect(filterTree(t, 'DUCT Supply', byId)!.elementIds).toHaveLength(12);
    // storey names are searchable too
    expect(filterTree(t, 'duct roof', byId)).toBeNull();
    expect(filterTree(t, 'pipe ground', byId)!.elementIds).toHaveLength(3);
  });
  it('finds an element by GlobalId', () => {
    const e = model.elements[42]!;
    const f = filterTree(t, e.globalId!, byId)!;
    expect(f.elementIds).toEqual([e.id]);
    expect(allBranchIds(f).length).toBeGreaterThan(0);
  });
  it('returns null when nothing matches', () => {
    expect(filterTree(t, 'no-such-thing', byId)).toBeNull();
  });
  it('uses element node ids', () => {
    expect(elementNodeId('a')).toBe('el:a');
  });
});

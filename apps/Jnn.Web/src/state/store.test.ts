import { createSampleModel } from '../domain/sampleModel';
import { createInitialState, defaultPlane, reducer } from './store';
import { elementNodeId } from '../domain/tree';

const model = createSampleModel();
const init = () => createInitialState(model, 'light');
const [a, b, c] = model.elements.map((e) => e.id);

describe('reducer', () => {
  it('replaces, toggles and adds selection', () => {
    let s = reducer(init(), { type: 'select', ids: [a!] });
    expect(s.selection).toEqual([a]);
    s = reducer(s, { type: 'select', ids: [b!], mode: 'toggle' });
    expect(s.selection).toEqual([a, b]);
    s = reducer(s, { type: 'select', ids: [a!], mode: 'toggle' });
    expect(s.selection).toEqual([b]);
    s = reducer(s, { type: 'select', ids: [c!, b!], mode: 'add' });
    expect(s.selection).toEqual([c, b]);
  });

  it('ignores unknown ids', () => {
    expect(reducer(init(), { type: 'select', ids: ['nope'] }).selection).toEqual([]);
  });

  it('removes hidden elements from the selection', () => {
    let s = reducer(init(), { type: 'select', ids: [a!, b!] });
    s = reducer(s, { type: 'hide', ids: [a!] });
    expect(s.selection).toEqual([b]);
    expect(s.visibility.hidden.has(a!)).toBe(true);
    s = reducer(s, { type: 'showAll' });
    expect(s.visibility.hidden.size).toBe(0);
  });

  it('reveals a picked element in both trees', () => {
    const target = model.elements.find((e) => e.category === 'Pipes')!.id;
    const s = reducer(init(), { type: 'select', ids: [target], reveal: true });
    const parentOf = (mode: 'spatial' | 'category') => {
      // the element's parent branch must be expanded
      const find = (n: typeof s.trees.spatial, p: string | null): string | null => {
        if (n.id === elementNodeId(target)) return p;
        for (const ch of n.children) {
          const r = find(ch, n.id);
          if (r) return r;
        }
        return null;
      };
      return find(s.trees[mode], null)!;
    };
    expect(s.expanded.spatial.has(parentOf('spatial'))).toBe(true);
    expect(s.expanded.category.has(parentOf('category'))).toBe(true);
  });

  it('keeps at most four notices', () => {
    let s = init();
    for (let i = 0; i < 6; i++) s = reducer(s, { type: 'notify', tone: 'info', text: String(i) });
    expect(s.notices.map((n) => n.text)).toEqual(['2', '3', '4', '5']);
  });

  it('supports federated models: append, toggle visibility, and remove', () => {
    let s = init();
    expect(s.models.length).toBe(1);
    const initialCount = s.model.elements.length;

    const secondModel = {
      ...createSampleModel(),
      modelId: 'struct-002',
      name: 'Structure Model',
      elements: [
        {
          ...model.elements[0]!,
          id: 'struct-002:beam-1',
          sourceElementId: 'beam-1',
          name: 'Steel Beam W12x26',
          category: 'IfcBeam',
        },
      ],
    };

    s = reducer(s, { type: 'appendModel', model: secondModel });
    expect(s.models.length).toBe(2);
    expect(s.model.elements.length).toBe(initialCount + 1);
    expect(s.byId.has('struct-002:beam-1')).toBe(true);

    // Hide second model
    s = reducer(s, { type: 'toggleModelVisibility', modelId: 'struct-002' });
    expect(s.models[1]?.visible).toBe(false);
    expect(s.visibility.hidden.has('struct-002:beam-1')).toBe(true);

    // Show second model
    s = reducer(s, { type: 'toggleModelVisibility', modelId: 'struct-002' });
    expect(s.models[1]?.visible).toBe(true);
    expect(s.visibility.hidden.has('struct-002:beam-1')).toBe(false);

    // Remove second model
    s = reducer(s, { type: 'removeModel', modelId: 'struct-002' });
    expect(s.models.length).toBe(1);
    expect(s.model.elements.length).toBe(initialCount);
    expect(s.byId.has('struct-002:beam-1')).toBe(false);
  });
});

describe('defaultPlane', () => {
  it('cuts plans 1.5 m above the lowest point', () => {
    const p = defaultPlane('z', { min: [0, 0, -0.25], max: [10, 10, 12] });
    expect(p).toEqual({ kind: 'plane', axis: 'z', offset: 1.25, flipped: false });
  });
  it('cuts vertical sections through the middle', () => {
    expect(defaultPlane('x', { min: [0, 0, 0], max: [24, 10, 12] }).offset).toBe(12);
  });
});

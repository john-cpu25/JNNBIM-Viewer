import { boundsOf, center, elementBounds, size, union } from './bounds';
import { placement } from './sampleModel';
import type { JnnElement } from './model';

const el = (size: [number, number, number], at: [number, number, number], rotZ = 0): JnnElement => ({
  modelId: 'm',
  modelRevisionId: 'r',
  sourceFormat: 'SAMPLE',
  sourceElementId: '1',
  globalId: null,
  id: 'r:1',
  name: 'x',
  category: 'Walls',
  type: 't',
  material: null,
  storey: null,
  transform: placement(...at, rotZ),
  properties: [],
  quantities: [],
  meshRefs: [{ bundleId: 'b', chunk: 0, primitive: { kind: 'box', center: [0, 0, 0], size, rotationZ: 0 } }],
  geometryStatus: 'ok',
  importWarnings: [],
});

describe('bounds', () => {
  it('computes an axis-aligned box from placement', () => {
    const b = elementBounds(el([2, 4, 6], [10, 20, 30]));
    expect(b.min).toEqual([9, 18, 27]);
    expect(b.max).toEqual([11, 22, 33]);
  });

  it('accounts for rotation about Z', () => {
    const b = elementBounds(el([2, 4, 1], [0, 0, 0], Math.PI / 2));
    expect(b.min[0]).toBeCloseTo(-2);
    expect(b.max[1]).toBeCloseTo(1);
  });

  it('unions and measures', () => {
    const b = union(elementBounds(el([2, 2, 2], [0, 0, 0])), elementBounds(el([2, 2, 2], [10, 0, 0])));
    expect(size(b)).toEqual([12, 2, 2]);
    expect(center(b)).toEqual([5, 0, 0]);
    expect(boundsOf([])).toMatchObject({ min: [Infinity, Infinity, Infinity] });
  });
});

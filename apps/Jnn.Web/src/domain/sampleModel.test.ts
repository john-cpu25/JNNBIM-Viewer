import { createSampleModel, makeGlobalId, createRng } from './sampleModel';

describe('createSampleModel', () => {
  const m = createSampleModel();

  it('is deterministic', () => {
    const again = createSampleModel();
    expect(again.elements.map((e) => e.globalId)).toEqual(m.elements.map((e) => e.globalId));
  });

  it('produces the expected element counts per category', () => {
    const count = (c: string) => m.elements.filter((e) => e.category === c).length;
    expect(count('Columns')).toBe(5 * 4 * 3); // grid intersections × storeys
    expect(count('Beams')).toBe((4 * 4 + 5 * 3) * 3);
    expect(count('Slabs')).toBe(3);
    expect(count('Doors')).toBe(2);
    expect(count('Roofs')).toBe(1);
    expect(m.elements.length).toBe(278);
  });

  it('assigns unique ids and valid IFC-style GlobalIds', () => {
    expect(new Set(m.elements.map((e) => e.id)).size).toBe(m.elements.length);
    expect(new Set(m.elements.map((e) => e.globalId)).size).toBe(m.elements.length);
    for (const e of m.elements) expect(e.globalId).toMatch(/^[0-3][0-9A-Za-z_$]{21}$/);
  });

  it('fills every field of the JNN contract', () => {
    for (const e of m.elements) {
      expect(e.modelId).toBe(m.modelId);
      expect(e.modelRevisionId).toBe(m.modelRevisionId);
      expect(e.sourceFormat).toBe('SAMPLE');
      expect(e.transform).toHaveLength(16);
      expect(e.meshRefs[0]?.primitive?.kind).toBe('box');
      expect(e.storey).toBeTruthy();
      for (const q of e.quantities) expect(q.value).toBeGreaterThan(0);
    }
  });

  it('subtracts window openings from net wall area', () => {
    const wall = m.elements.find((e) => e.type.includes('Exterior') && e.importWarnings.length)!;
    const gross = wall.quantities.find((q) => q.name === 'GrossSideArea')!.value;
    const net = wall.quantities.find((q) => q.name === 'NetSideArea')!.value;
    expect(gross - net).toBeCloseTo(3.2 * 1.8, 2);
  });
});

describe('makeGlobalId', () => {
  it('returns 22 characters', () => {
    expect(makeGlobalId(createRng(1))).toHaveLength(22);
  });
});

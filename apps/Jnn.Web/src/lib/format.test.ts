import { aggregateQuantities, formatValue } from './format';

describe('format', () => {
  it('formats property values', () => {
    expect(formatValue(true)).toBe('Yes');
    expect(formatValue(null)).toBe('—');
    expect(formatValue(1234.56789)).toBe('1,234.568');
  });
  it('aggregates quantities by name and unit', () => {
    const r = aggregateQuantities([
      [{ name: 'NetVolume', value: 1.5, unit: 'm³' }],
      [{ name: 'NetVolume', value: 2, unit: 'm³' }, { name: 'Length', value: 3, unit: 'm' }],
    ]);
    expect(r).toEqual([
      { name: 'Length', unit: 'm', total: 3, count: 1 },
      { name: 'NetVolume', unit: 'm³', total: 3.5, count: 2 },
    ]);
  });
});

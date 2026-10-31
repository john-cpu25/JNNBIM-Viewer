import { describe, expect, it, beforeEach } from 'vitest';
import {
  convertMeasureValue,
  exportMeasurementsCsv,
  formatMeasure,
  loadSavedMeasureSettings,
  saveMeasureSettings,
} from './measure';
import type { MeasureItem } from '../viewer/ViewerAdapter';

describe('convertMeasureValue', () => {
  it('converts meters to mm, cm, m with precision', () => {
    expect(convertMeasureValue(8.1206, 'length', 'mm', 1)).toEqual({ value: 8120.6, unit: 'mm' });
    expect(convertMeasureValue(8.1206, 'length', 'cm', 2)).toEqual({ value: 812.06, unit: 'cm' });
    expect(convertMeasureValue(8.1206, 'length', 'm', 3)).toEqual({ value: 8.121, unit: 'm' });
  });

  it('converts area m2 to mm2, cm2, m2', () => {
    expect(convertMeasureValue(2.5, 'area', 'mm', 0)).toEqual({ value: 2500000, unit: 'mm2' });
    expect(convertMeasureValue(2.5, 'area', 'cm', 1)).toEqual({ value: 25000, unit: 'cm2' });
    expect(convertMeasureValue(2.5, 'area', 'm', 2)).toEqual({ value: 2.5, unit: 'm2' });
  });

  it('converts radians to degrees', () => {
    expect(convertMeasureValue(Math.PI / 2, 'angle', 'mm', 1)).toEqual({ value: 90, unit: 'deg' });
  });
});

describe('formatMeasure', () => {
  it('formats linear measurements with mm/cm/m', () => {
    expect(formatMeasure(1250, 'mm', 0)).toBe('1250 mm');
    expect(formatMeasure(12.5, 'cm', 1)).toBe('12.5 cm');
    expect(formatMeasure(3.456, 'm', 2)).toBe('3.46 m');
  });

  it('formats angle measurements with degree symbol', () => {
    expect(formatMeasure(90, 'deg', 1)).toBe('90.0°');
    expect(formatMeasure(45.25, 'deg', 2)).toBe('45.25°');
  });

  it('formats area and volume with superscripts', () => {
    expect(formatMeasure(15.2, 'm2', 2)).toBe('15.20 m²');
    expect(formatMeasure(3.14, 'm3', 2)).toBe('3.14 m³');
  });
});

describe('exportMeasurementsCsv', () => {
  it('includes UTF-8 BOM and formats columns', () => {
    const items: MeasureItem[] = [
      {
        id: 'm1',
        tool: 'length',
        value: 1250,
        unit: 'mm',
        points: [
          [0, 0, 0],
          [1.25, 0, 0],
        ],
      },
      {
        id: 'm2',
        tool: 'angle',
        value: 90,
        unit: 'deg',
        points: [
          [1, 0, 0],
          [0, 0, 0],
          [0, 1, 0],
        ],
      },
    ];

    const csv = exportMeasurementsCsv(items);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Type,Value,Unit,Points');
    expect(csv).toContain('length,1250,mm,"(0.000, 0.000, 0.000) | (1.250, 0.000, 0.000)"');
    expect(csv).toContain('angle,90,deg,"(1.000, 0.000, 0.000) | (0.000, 0.000, 0.000) | (0.000, 1.000, 0.000)"');
  });
});

describe('measure settings persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads fallback defaults when localStorage is empty', () => {
    const settings = loadSavedMeasureSettings();
    expect(settings.unit).toBe('mm');
    expect(settings.precision).toBe(1);
    expect(settings.snap.vertex).toBe(true);
  });

  it('saves and reloads settings correctly', () => {
    saveMeasureSettings({
      unit: 'm',
      precision: 3,
      snap: { vertex: true, edge: false, face: true },
    });
    const loaded = loadSavedMeasureSettings();
    expect(loaded.unit).toBe('m');
    expect(loaded.precision).toBe(3);
    expect(loaded.snap.edge).toBe(false);
    expect(loaded.snap.face).toBe(true);
  });
});

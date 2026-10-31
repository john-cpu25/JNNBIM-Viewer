import type { MeasureItem, MeasureSettings, MeasureUnit } from '../viewer/ViewerAdapter';

export const MEASURE_SETTINGS_STORAGE_KEY = 'jnn-measure-settings';

export function loadSavedMeasureSettings(): MeasureSettings {
  const fallback: MeasureSettings = {
    unit: 'mm',
    precision: 1,
    snap: { vertex: true, edge: true, face: false },
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(MEASURE_SETTINGS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      unit: ['mm', 'cm', 'm'].includes(parsed.unit) ? (parsed.unit as MeasureUnit) : 'mm',
      precision: [0, 1, 2, 3].includes(parsed.precision) ? parsed.precision : 1,
      snap: {
        vertex: typeof parsed.snap?.vertex === 'boolean' ? parsed.snap.vertex : true,
        edge: typeof parsed.snap?.edge === 'boolean' ? parsed.snap.edge : true,
        face: typeof parsed.snap?.face === 'boolean' ? parsed.snap.face : false,
      },
    };
  } catch {
    return fallback;
  }
}

export function saveMeasureSettings(settings: MeasureSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MEASURE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save measure settings to localStorage:', err);
  }
}

export function formatMeasure(value: number, unit: string, precision = 1): string {
  const rounded = value.toFixed(precision);
  if (unit === 'deg') {
    return `${rounded}°`;
  }
  if (unit === 'rad') {
    return `${rounded} rad`;
  }
  if (unit.endsWith('2')) {
    return `${rounded} ${unit.slice(0, -1)}²`;
  }
  if (unit.endsWith('3')) {
    return `${rounded} ${unit.slice(0, -1)}³`;
  }
  return `${rounded} ${unit}`;
}

export function exportMeasurementsCsv(items: MeasureItem[]): string {
  const header = ['Type', 'Value', 'Unit', 'Points'];
  const rows = items.map((item) => {
    const pts = item.points.map((p) => `(${p[0].toFixed(3)}, ${p[1].toFixed(3)}, ${p[2].toFixed(3)})`).join(' | ');
    return [
      item.tool,
      item.value.toString(),
      item.unit,
      `"${pts.replace(/"/g, '""')}"`,
    ].join(',');
  });

  return '\uFEFF' + [header.join(','), ...rows].join('\r\n');
}

export function downloadMeasurementsCsv(items: MeasureItem[], filename = 'measurements.csv'): void {
  const csv = exportMeasurementsCsv(items);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

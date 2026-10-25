export function formatNumber(v: number, maxFrac = 3): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: maxFrac, minimumFractionDigits: 0 });
}

export function formatValue(v: string | number | boolean | null): string {
  if (v === null) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return formatNumber(v);
  return v;
}

/** Sum quantities with the same name+unit across elements. */
export function aggregateQuantities(
  lists: { name: string; value: number; unit: string }[][],
): { name: string; unit: string; total: number; count: number }[] {
  const m = new Map<string, { name: string; unit: string; total: number; count: number }>();
  for (const list of lists)
    for (const q of list) {
      const k = `${q.name}|${q.unit}`;
      const cur = m.get(k) ?? { name: q.name, unit: q.unit, total: 0, count: 0 };
      cur.total += q.value;
      cur.count += 1;
      m.set(k, cur);
    }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
}

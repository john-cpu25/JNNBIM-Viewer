import type { ClashTestItem } from './clashState';
import type { ClashRecord } from './clashResults';

/**
 * Escapes a single CSV field according to RFC 4180.
 * If the field contains comma, double quote, newline (\n) or carriage return (\r),
 * it is enclosed in double quotes and any internal double quotes are replaced with double-double quotes ("").
 */
export function escapeCsvField(val: string | number | undefined | null): string {
  if (val === undefined || val === null) {
    return '';
  }
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const CSV_HEADERS = [
  'STT',
  'Clash ID',
  'Trạng thái',
  'Loại',
  'Khoảng cách (m)',
  'GlobalId A',
  'Tên A',
  'IFC Class A',
  'GlobalId B',
  'Tên B',
  'IFC Class B',
  'Tầng',
  'Điểm clash (X,Y,Z)',
  'Ghi chú',
  'Người phụ trách',
];

/**
 * Exports clash test records to a CSV string with UTF-8 BOM (\uFEFF)
 * for proper display in Excel with Vietnamese characters.
 */
export function exportClashCSV(test: ClashTestItem): string {
  const records: ClashRecord[] = test.records ?? [];
  const lines: string[] = [];

  // 1. Header row
  lines.push(CSV_HEADERS.map(escapeCsvField).join(','));

  // 2. Data rows
  records.forEach((r, idx) => {
    const stt = idx + 1;
    const clashId = r.clashId;
    const status = r.status;
    const type = r.type;
    const distance = r.distance !== undefined ? r.distance.toFixed(6) : '0.000000';
    const aGuid = r.aGuid ?? '';
    const aName = r.aName ?? '';
    const aClass = r.aClass ?? '';
    const bGuid = r.bGuid ?? '';
    const bName = r.bName ?? '';
    const bClass = r.bClass ?? '';
    const storey = r.aStorey || r.bStorey || '';
    const pointStr = r.point
      ? `${r.point[0].toFixed(3)}, ${r.point[1].toFixed(3)}, ${r.point[2].toFixed(3)}`
      : '';
    const comments = r.comments ?? '';
    const assignedTo = r.assignedTo ?? '';

    const row = [
      stt,
      clashId,
      status,
      type,
      distance,
      aGuid,
      aName,
      aClass,
      bGuid,
      bName,
      bClass,
      storey,
      pointStr,
      comments,
      assignedTo,
    ];

    lines.push(row.map(escapeCsvField).join(','));
  });

  // UTF-8 BOM (\uFEFF) prefixed
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Triggers a browser download for string or Blob content.
 */
export function downloadFile(
  content: string | Blob,
  filename: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

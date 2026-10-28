import { Workbook } from 'exceljs';
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
 * Exports clash test details to a stylized Microsoft Excel (.xlsx) workbook Blob
 * with 2 sheets: "Tổng quan" (Overview & Statistics) and "Kết quả" (Detailed Records).
 */
export async function exportClashExcel(test: ClashTestItem): Promise<Blob> {
  const records: ClashRecord[] = test.records ?? [];
  const workbook = new Workbook();
  workbook.creator = 'JNN BIM Viewer';
  workbook.created = new Date();

  // ----------------------------------------------------
  // Sheet 1: Tổng quan
  // ----------------------------------------------------
  const sheetOverview = workbook.addWorksheet('Tổng quan');
  sheetOverview.columns = [
    { key: 'param', width: 28 },
    { key: 'value', width: 40 },
    { key: 'extra', width: 16 },
  ];

  // Title
  sheetOverview.addRow(['BÁO CÁO TỔNG QUAN CLASH DETECTION', '']);
  const titleCell = sheetOverview.getCell('A1');
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };
  sheetOverview.addRow([]);

  // Test information metadata
  const runDateStr = test.lastRunTime
    ? new Date(test.lastRunTime).toLocaleString('vi-VN')
    : new Date().toLocaleString('vi-VN');

  const criteriaA = `Model: ${test.selectionA?.modelId || 'Tất cả'} | Phân loại: ${test.selectionA?.ifcClass || 'Tất cả'}`;
  const criteriaB = `Model: ${test.selectionB?.modelId || 'Tất cả'} | Phân loại: ${test.selectionB?.ifcClass || 'Tất cả'}`;

  const metaRows: [string, string | number][] = [
    ['Tên kiểm tra (Test Name):', test.name],
    ['Ngày xuất báo cáo:', runDateStr],
    ['Loại kiểm tra:', test.type],
    ['Dung sai (Tolerance):', `${test.tolerance} m`],
    ['Tiêu chí chọn A:', criteriaA],
    ['Tiêu chí chọn B:', criteriaB],
    ['Tổng số va chạm:', records.length],
  ];

  for (const [param, val] of metaRows) {
    const r = sheetOverview.addRow([param, val]);
    r.getCell(1).font = { bold: true, color: { argb: 'FF334155' } };
  }

  sheetOverview.addRow([]);

  // Status statistics table
  const statHeader = sheetOverview.addRow(['Trạng thái', 'Số lượng', 'Tỷ lệ (%)']);
  statHeader.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    c.alignment = { horizontal: 'center' };
  });

  const statusCounts: Record<string, number> = {
    New: 0,
    Active: 0,
    Reviewed: 0,
    Approved: 0,
    Resolved: 0,
  };

  for (const rec of records) {
    if (rec.status in statusCounts) {
      statusCounts[rec.status] = (statusCounts[rec.status] ?? 0) + 1;
    }
  }

  const totalClashes = records.length;
  const statuses = ['New', 'Active', 'Reviewed', 'Approved', 'Resolved'] as const;

  for (const st of statuses) {
    const cnt = statusCounts[st] ?? 0;
    const pct = totalClashes > 0 ? ((cnt / totalClashes) * 100).toFixed(1) + '%' : '0.0%';
    const row = sheetOverview.addRow([st, cnt, pct]);
    row.getCell(2).alignment = { horizontal: 'right' };
    row.getCell(3).alignment = { horizontal: 'right' };
  }

  const summaryRow = sheetOverview.addRow(['Tổng cộng', totalClashes, '100%']);
  summaryRow.font = { bold: true };
  summaryRow.getCell(2).alignment = { horizontal: 'right' };
  summaryRow.getCell(3).alignment = { horizontal: 'right' };

  // ----------------------------------------------------
  // Sheet 2: Kết quả
  // ----------------------------------------------------
  const sheetResults = workbook.addWorksheet('Kết quả');

  // Freeze pane: Freeze column A (STT) and row 1 (Header)
  sheetResults.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  // Column headers & dimensions
  sheetResults.columns = [
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Clash ID', key: 'clashId', width: 16 },
    { header: 'Trạng thái', key: 'status', width: 14 },
    { header: 'Loại', key: 'type', width: 14 },
    { header: 'Khoảng cách (m)', key: 'distance', width: 18 },
    { header: 'GlobalId A', key: 'aGuid', width: 26 },
    { header: 'Tên A', key: 'aName', width: 28 },
    { header: 'IFC Class A', key: 'aClass', width: 16 },
    { header: 'GlobalId B', key: 'bGuid', width: 26 },
    { header: 'Tên B', key: 'bName', width: 28 },
    { header: 'IFC Class B', key: 'bClass', width: 16 },
    { header: 'Tầng', key: 'storey', width: 14 },
    { header: 'Điểm clash (X,Y,Z)', key: 'point', width: 25 },
    { header: 'Ghi chú', key: 'comments', width: 35 },
    { header: 'Người phụ trách', key: 'assignedTo', width: 20 },
  ];

  // Header row formatting
  const headerRow = sheetResults.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
    };
  });

  // Data rows
  records.forEach((r, idx) => {
    const stt = idx + 1;
    const distanceVal = r.distance !== undefined ? r.distance : 0;
    const storey = r.aStorey || r.bStorey || '';
    const pointStr = r.point
      ? `${r.point[0].toFixed(3)}, ${r.point[1].toFixed(3)}, ${r.point[2].toFixed(3)}`
      : '';

    const newRow = sheetResults.addRow({
      stt,
      clashId: r.clashId,
      status: r.status,
      type: r.type,
      distance: distanceVal,
      aGuid: r.aGuid ?? '',
      aName: r.aName ?? '',
      aClass: r.aClass ?? '',
      bGuid: r.bGuid ?? '',
      bName: r.bName ?? '',
      bClass: r.bClass ?? '',
      storey,
      point: pointStr,
      comments: r.comments ?? '',
      assignedTo: r.assignedTo ?? '',
    });

    // Formatting
    newRow.getCell('stt').alignment = { horizontal: 'center' };
    newRow.getCell('status').alignment = { horizontal: 'center' };
    newRow.getCell('type').alignment = { horizontal: 'center' };

    // Format distance column to 6 decimals
    const distCell = newRow.getCell('distance');
    distCell.numFmt = '0.000000';
    distCell.alignment = { horizontal: 'right' };

    // Cell status styling
    const statusCell = newRow.getCell('status');
    if (r.status === 'New') {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEE2E2' },
      };
      statusCell.font = { color: { argb: 'FF991B1B' }, bold: true };
    } else if (r.status === 'Resolved') {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD1FAE5' },
      };
      statusCell.font = { color: { argb: 'FF065F46' } };
    } else if (r.status === 'Active') {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF3C7' },
      };
      statusCell.font = { color: { argb: 'FF92400E' } };
    }
  });

  // Autofilter for columns A-O
  const endRowIdx = Math.max(records.length + 1, 1);
  sheetResults.autoFilter = {
    from: 'A1',
    to: `O${endRowIdx}`,
  };

  // Conditional formatting on Status column (Column C)
  if (records.length > 0) {
    sheetResults.addConditionalFormatting({
      ref: `C2:C${records.length + 1}`,
      rules: [
        {
          priority: 1,
          type: 'cellIs',
          operator: 'equal',
          formulae: ['"New"'],
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              bgColor: { argb: 'FFFEE2E2' },
              fgColor: { argb: 'FFFEE2E2' },
            },
            font: { color: { argb: 'FF991B1B' }, bold: true },
          },
        },
        {
          priority: 2,
          type: 'cellIs',
          operator: 'equal',
          formulae: ['"Resolved"'],
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              bgColor: { argb: 'FFD1FAE5' },
              fgColor: { argb: 'FFD1FAE5' },
            },
            font: { color: { argb: 'FF065F46' } },
          },
        },
      ],
    });
  }

  // Generate ArrayBuffer and create Blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
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

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

export const CSV_HEADERS_EN = [
  'No.',
  'Clash ID',
  'Status',
  'Type',
  'Distance (m)',
  'GlobalId A',
  'Name A',
  'IFC Class A',
  'GlobalId B',
  'Name B',
  'IFC Class B',
  'Storey',
  'Clash Point (X,Y,Z)',
  'Comments',
  'Assigned To',
];

/**
 * Exports clash test records to a CSV string with UTF-8 BOM (\uFEFF)
 * for proper display in Excel with Vietnamese characters.
 */
export function exportClashCSV(test: ClashTestItem, locale: 'vi' | 'en' = 'vi'): string {
  const records: ClashRecord[] = test.records ?? [];
  const lines: string[] = [];

  // 1. Header row
  const headers = locale === 'en' ? CSV_HEADERS_EN : CSV_HEADERS;
  lines.push(headers.map(escapeCsvField).join(','));

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
export async function exportClashExcel(test: ClashTestItem, locale: 'vi' | 'en' = 'vi'): Promise<Blob> {
  const records: ClashRecord[] = test.records ?? [];
  const isEn = locale === 'en';
  const workbook = new Workbook();
  workbook.creator = 'JNN BIM Viewer';
  workbook.created = new Date();

  // ----------------------------------------------------
  // Sheet 1: Tổng quan / Overview
  // ----------------------------------------------------
  const sheetOverview = workbook.addWorksheet(isEn ? 'Overview' : 'Tổng quan');
  sheetOverview.columns = [
    { key: 'param', width: 28 },
    { key: 'value', width: 40 },
    { key: 'extra', width: 16 },
  ];

  // Title
  sheetOverview.addRow([isEn ? 'CLASH DETECTION OVERVIEW REPORT' : 'BÁO CÁO TỔNG QUAN CLASH DETECTION', '']);
  const titleCell = sheetOverview.getCell('A1');
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };
  sheetOverview.addRow([]);

  // Test information metadata
  const runDateStr = test.lastRunTime
    ? new Date(test.lastRunTime).toLocaleString(isEn ? 'en-US' : 'vi-VN')
    : new Date().toLocaleString(isEn ? 'en-US' : 'vi-VN');

  const allStr = isEn ? 'All' : 'Tất cả';
  const criteriaA = isEn
    ? `Model: ${test.selectionA?.modelId || allStr} | Class: ${test.selectionA?.ifcClass || allStr}`
    : `Model: ${test.selectionA?.modelId || allStr} | Phân loại: ${test.selectionA?.ifcClass || allStr}`;
  const criteriaB = isEn
    ? `Model: ${test.selectionB?.modelId || allStr} | Class: ${test.selectionB?.ifcClass || allStr}`
    : `Model: ${test.selectionB?.modelId || allStr} | Phân loại: ${test.selectionB?.ifcClass || allStr}`;

  const metaRows: [string, string | number][] = isEn
    ? [
        ['Test Name:', test.name],
        ['Report Date:', runDateStr],
        ['Check Type:', test.type],
        ['Tolerance:', `${test.tolerance} m`],
        ['Selection Criteria A:', criteriaA],
        ['Selection Criteria B:', criteriaB],
        ['Total Clashes:', records.length],
      ]
    : [
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
  const statHeader = sheetOverview.addRow(
    isEn ? ['Status', 'Count', 'Ratio (%)'] : ['Trạng thái', 'Số lượng', 'Tỷ lệ (%)'],
  );
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

  const summaryRow = sheetOverview.addRow([isEn ? 'Total' : 'Tổng cộng', totalClashes, '100%']);
  summaryRow.font = { bold: true };
  summaryRow.getCell(2).alignment = { horizontal: 'right' };
  summaryRow.getCell(3).alignment = { horizontal: 'right' };

  // ----------------------------------------------------
  // Sheet 2: Kết quả / Results
  // ----------------------------------------------------
  const sheetResults = workbook.addWorksheet(isEn ? 'Results' : 'Kết quả');

  // Freeze pane: Freeze column A (STT) and row 1 (Header)
  sheetResults.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  // Column headers & dimensions
  const resHeaders = isEn ? CSV_HEADERS_EN : CSV_HEADERS;
  sheetResults.columns = [
    { header: resHeaders[0], key: 'stt', width: 8 },
    { header: resHeaders[1], key: 'clashId', width: 16 },
    { header: resHeaders[2], key: 'status', width: 14 },
    { header: resHeaders[3], key: 'type', width: 14 },
    { header: resHeaders[4], key: 'distance', width: 18 },
    { header: resHeaders[5], key: 'aGuid', width: 26 },
    { header: resHeaders[6], key: 'aName', width: 28 },
    { header: resHeaders[7], key: 'aClass', width: 16 },
    { header: resHeaders[8], key: 'bGuid', width: 26 },
    { header: resHeaders[9], key: 'bName', width: 28 },
    { header: resHeaders[10], key: 'bClass', width: 16 },
    { header: resHeaders[11], key: 'storey', width: 14 },
    { header: resHeaders[12], key: 'point', width: 25 },
    { header: resHeaders[13], key: 'comments', width: 35 },
    { header: resHeaders[14], key: 'assignedTo', width: 20 },
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
 * Escapes special HTML characters to prevent XSS and preserve text structure.
 */
export function escapeHtml(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Exports clash test details to a completely self-contained, standalone HTML report
 * with inline CSS, responsive layout, printable stylesheet (@media print),
 * summary breakdown metrics, and vanilla JavaScript for client-side sorting & search filtering.
 */
export function exportClashHTML(test: ClashTestItem, locale: 'vi' | 'en' = 'vi'): string {
  const records: ClashRecord[] = test.records ?? [];
  const isEn = locale === 'en';
  const defaultTitle = isEn ? 'Clash Detection Report' : 'Báo cáo va chạm';
  const testName = escapeHtml(test.name || defaultTitle);
  const runDateStr = test.lastRunTime
    ? new Date(test.lastRunTime).toLocaleString(isEn ? 'en-US' : 'vi-VN')
    : new Date().toLocaleString(isEn ? 'en-US' : 'vi-VN');
  const nowStr = new Date().toLocaleString(isEn ? 'en-US' : 'vi-VN');

  // Count by status
  const statusCounts: Record<string, number> = {
    New: 0,
    Active: 0,
    Reviewed: 0,
    Approved: 0,
    Resolved: 0,
  };

  // Count by type
  const typeCounts: Record<string, number> = {
    Hard: 0,
    Clearance: 0,
    Duplicates: 0,
  };

  for (const r of records) {
    if (r.status in statusCounts) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    if (r.type in typeCounts) typeCounts[r.type] = (typeCounts[r.type] ?? 0) + 1;
  }

  const rowsHtml = records
    .map((r, idx) => {
      const stt = idx + 1;
      const dist = r.distance !== undefined ? r.distance.toFixed(6) : '0.000000';
      const pointStr = r.point
        ? `${r.point[0].toFixed(3)}, ${r.point[1].toFixed(3)}, ${r.point[2].toFixed(3)}`
        : '';
      const storey = r.aStorey || r.bStorey || '';

      let badgeClass = 'badge-other';
      if (r.status === 'New') badgeClass = 'badge-new';
      else if (r.status === 'Active') badgeClass = 'badge-active';
      else if (r.status === 'Reviewed') badgeClass = 'badge-reviewed';
      else if (r.status === 'Approved') badgeClass = 'badge-approved';
      else if (r.status === 'Resolved') badgeClass = 'badge-resolved';

      return `<tr class="data-row" data-status="${escapeHtml(r.status)}" data-type="${escapeHtml(r.type)}">
        <td class="text-center font-mono">${stt}</td>
        <td class="font-mono text-xs">${escapeHtml(r.clashId)}</td>
        <td class="text-center"><span class="badge ${badgeClass}">${escapeHtml(r.status)}</span></td>
        <td class="text-center text-xs font-semibold">${escapeHtml(r.type)}</td>
        <td class="text-right font-mono text-xs">${dist}</td>
        <td class="font-mono text-xs" title="${escapeHtml(r.aGuid)}">${escapeHtml(r.aGuid)}</td>
        <td class="text-sm font-medium" title="${escapeHtml(r.aName)}">${escapeHtml(r.aName)}</td>
        <td class="text-xs text-secondary">${escapeHtml(r.aClass)}</td>
        <td class="font-mono text-xs" title="${escapeHtml(r.bGuid)}">${escapeHtml(r.bGuid)}</td>
        <td class="text-sm font-medium" title="${escapeHtml(r.bName)}">${escapeHtml(r.bName)}</td>
        <td class="text-xs text-secondary">${escapeHtml(r.bClass)}</td>
        <td class="text-center text-xs">${escapeHtml(storey)}</td>
        <td class="font-mono text-xs text-secondary">${escapeHtml(pointStr)}</td>
        <td class="text-xs text-break">${escapeHtml(r.comments)}</td>
        <td class="text-xs font-medium">${escapeHtml(r.assignedTo)}</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo Cáo Va Chạm - ${testName}</title>
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --primary-light: #eff6ff;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px 24px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .header-brand { display: flex; align-items: center; gap: 12px; }
    .header-logo {
      width: 40px; height: 40px; background: #1e293b; color: #fff;
      display: flex; align-items: center; justify-content: center;
      border-radius: 8px; font-weight: bold; font-size: 18px;
    }
    .header-title h1 { font-size: 20px; font-weight: 700; color: var(--text); }
    .header-title p { font-size: 13px; color: var(--text-muted); }
    .btn-print {
      background: var(--primary); color: #fff; border: none; border-radius: 6px;
      padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
      transition: background 0.2s;
    }
    .btn-print:hover { background: var(--primary-dark); }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .meta-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 18px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    .meta-card .label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px; }
    .meta-card .val { font-size: 14px; font-weight: 600; color: var(--text); }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
      text-align: center;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    .stat-card .count { font-size: 26px; font-weight: 800; line-height: 1.2; }
    .stat-card .desc { font-size: 12px; font-weight: 500; color: var(--text-muted); margin-top: 4px; }
    .stat-total .count { color: #0f172a; }
    .stat-new .count { color: #e11d48; }
    .stat-active .count { color: #d97706; }
    .stat-reviewed .count { color: #0284c7; }
    .stat-approved .count { color: #059669; }
    .stat-resolved .count { color: #64748b; }
    .controls {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px 8px 0 0;
      padding: 12px 16px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
    }
    .controls-left { display: flex; gap: 8px; flex: 1; flex-wrap: wrap; }
    .search-input {
      min-width: 240px; flex: 1; padding: 7px 12px; font-size: 13px;
      border: 1px solid var(--border); border-radius: 6px; outline: none;
    }
    .search-input:focus { border-color: var(--primary); }
    .filter-select {
      padding: 7px 10px; font-size: 13px; border: 1px solid var(--border);
      border-radius: 6px; background: #fff; outline: none; cursor: pointer;
    }
    .filter-select:focus { border-color: var(--primary); }
    .table-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 0 0 8px 8px;
      overflow-x: auto;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      margin-bottom: 24px;
    }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    thead th {
      background: #1e293b; color: #f8fafc; padding: 10px 12px; font-size: 11px;
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
      white-space: nowrap; user-select: none; cursor: pointer;
    }
    thead th:hover { background: #334155; }
    tbody tr { border-bottom: 1px solid var(--border); transition: background 0.15s; }
    tbody tr:hover { background: #f1f5f9; }
    tbody td { padding: 9px 12px; vertical-align: middle; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-xs { font-size: 11px; }
    .text-sm { font-size: 13px; }
    .text-secondary { color: var(--text-muted); }
    .text-break { max-width: 250px; word-break: break-word; }
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 12px;
      font-size: 10px; font-weight: 700; text-transform: uppercase;
    }
    .badge-new { background: #ffe4e6; color: #be123c; }
    .badge-active { background: #fef3c7; color: #b45309; }
    .badge-reviewed { background: #e0f2fe; color: #0369a1; }
    .badge-approved { background: #d1fae5; color: #047857; }
    .badge-resolved { background: #f1f5f9; color: #64748b; text-decoration: line-through; }
    .badge-other { background: #e2e8f0; color: #475569; }
    .footer { text-align: center; font-size: 12px; color: var(--text-muted); padding: 16px; }
    @media print {
      body { background: #fff; padding: 0; }
      .container { max-width: 100%; }
      .btn-print, .controls { display: none !important; }
      .header, .table-card, .meta-card, .stat-card { box-shadow: none; border-color: #cbd5e1; }
      thead th { background: #334155 !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .badge { border: 1px solid #cbd5e1; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-brand">
        <div class="header-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
        </div>
        <div class="header-title">
          <h1>${testName}</h1>
          <p>${isEn ? 'Clash Detection Report • JNN BIM Viewer' : 'Báo Cáo Kiểm Tra Va Chạm (Clash Detection Report) • JNN BIM Viewer'}</p>
        </div>
      </div>
      <button class="btn-print" onclick="window.print()">${isEn ? 'Print Report / Export PDF' : 'In báo cáo / Xuất PDF'}</button>
    </div>

    <!-- Metadata Grid -->
    <div class="meta-grid">
      <div class="meta-card">
        <div class="label">${isEn ? 'Report Date' : 'Thời gian xuất báo cáo'}</div>
        <div class="val">${nowStr}</div>
      </div>
      <div class="meta-card">
        <div class="label">${isEn ? 'Check Type & Tolerance' : 'Loại kiểm tra & Dung sai'}</div>
        <div class="val">${escapeHtml(test.type)} (${test.tolerance} m)</div>
      </div>
      <div class="meta-card">
        <div class="label">${isEn ? 'Selection Criteria A' : 'Tiêu chí đối tượng A'}</div>
        <div class="val">${escapeHtml(test.selectionA?.modelId || (isEn ? 'All Models' : 'Mọi Model'))} / ${escapeHtml(test.selectionA?.ifcClass || (isEn ? 'All Classes' : 'Mọi Phân loại'))}</div>
      </div>
      <div class="meta-card">
        <div class="label">${isEn ? 'Selection Criteria B' : 'Tiêu chí đối tượng B'}</div>
        <div class="val">${escapeHtml(test.selectionB?.modelId || (isEn ? 'All Models' : 'Mọi Model'))} / ${escapeHtml(test.selectionB?.ifcClass || (isEn ? 'All Classes' : 'Mọi Phân loại'))}</div>
      </div>
    </div>

    <!-- Summary Metrics Cards -->
    <div class="summary-cards">
      <div class="stat-card stat-total">
        <div class="count">${records.length}</div>
        <div class="desc">${isEn ? 'Total Clashes' : 'Tổng số va chạm'}</div>
      </div>
      <div class="stat-card stat-new">
        <div class="count">${statusCounts['New'] ?? 0}</div>
        <div class="desc">${isEn ? 'New' : 'Mới (New)'}</div>
      </div>
      <div class="stat-card stat-active">
        <div class="count">${statusCounts['Active'] ?? 0}</div>
        <div class="desc">${isEn ? 'Active' : 'Đang xử lý (Active)'}</div>
      </div>
      <div class="stat-card stat-reviewed">
        <div class="count">${statusCounts['Reviewed'] ?? 0}</div>
        <div class="desc">${isEn ? 'Reviewed' : 'Đã xem (Reviewed)'}</div>
      </div>
      <div class="stat-card stat-approved">
        <div class="count">${statusCounts['Approved'] ?? 0}</div>
        <div class="desc">${isEn ? 'Approved' : 'Đã duyệt (Approved)'}</div>
      </div>
      <div class="stat-card stat-resolved">
        <div class="count">${statusCounts['Resolved'] ?? 0}</div>
        <div class="desc">${isEn ? 'Resolved' : 'Đã xử lý (Resolved)'}</div>
      </div>
    </div>

    <!-- Interactive Filter Toolbar -->
    <div class="controls">
      <div class="controls-left">
        <input type="text" id="searchInput" class="search-input" placeholder="${isEn ? 'Search by ID, name, GUID, storey, comments...' : 'Tìm kiếm theo ID, tên, GUID, tầng, ghi chú...'}" oninput="applyFilters()">
        <select id="statusFilter" class="filter-select" onchange="applyFilters()">
          <option value="ALL">${isEn ? `All Statuses (${records.length})` : `Mọi trạng thái (${records.length})`}</option>
          <option value="New">New</option>
          <option value="Active">Active</option>
          <option value="Reviewed">Reviewed</option>
          <option value="Approved">Approved</option>
          <option value="Resolved">Resolved</option>
        </select>
        <select id="typeFilter" class="filter-select" onchange="applyFilters()">
          <option value="ALL">${isEn ? 'All Clash Types' : 'Mọi loại va chạm'}</option>
          <option value="Hard">Hard</option>
          <option value="Clearance">Clearance</option>
          <option value="Duplicates">Duplicates</option>
        </select>
      </div>
      <div id="resultsCount" class="text-xs font-semibold text-secondary">
        ${isEn ? `Showing ${records.length} / ${records.length} clashes` : `Hiển thị ${records.length} / ${records.length} va chạm`}
      </div>
    </div>

    <!-- Detailed Clashes Table -->
    <div class="table-card">
      <table id="clashTable">
        <thead>
          <tr>
            <th onclick="sortTable(0)">${isEn ? 'No. ↕' : 'STT ↕'}</th>
            <th onclick="sortTable(1)">Clash ID ↕</th>
            <th onclick="sortTable(2)">${isEn ? 'Status ↕' : 'Trạng thái ↕'}</th>
            <th onclick="sortTable(3)">${isEn ? 'Type ↕' : 'Loại ↕'}</th>
            <th onclick="sortTable(4)">${isEn ? 'Distance (m) ↕' : 'Khoảng cách (m) ↕'}</th>
            <th onclick="sortTable(5)">GlobalId A ↕</th>
            <th onclick="sortTable(6)">${isEn ? 'Name A ↕' : 'Tên A ↕'}</th>
            <th onclick="sortTable(7)">IFC Class A ↕</th>
            <th onclick="sortTable(8)">GlobalId B ↕</th>
            <th onclick="sortTable(9)">${isEn ? 'Name B ↕' : 'Tên B ↕'}</th>
            <th onclick="sortTable(10)">IFC Class B ↕</th>
            <th onclick="sortTable(11)">${isEn ? 'Storey ↕' : 'Tầng ↕'}</th>
            <th onclick="sortTable(12)">${isEn ? 'Clash Point ↕' : 'Điểm clash ↕'}</th>
            <th onclick="sortTable(13)">${isEn ? 'Comments ↕' : 'Ghi chú ↕'}</th>
            <th onclick="sortTable(14)">${isEn ? 'Assigned To ↕' : 'Phụ trách ↕'}</th>
          </tr>
        </thead>
        <tbody id="tableBody">
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div class="footer">
      ${isEn ? `Automatically generated by JNN BIM Viewer • ${runDateStr}` : `Báo cáo được khởi tạo tự động bởi JNN BIM Viewer • ${runDateStr}`}
    </div>
  </div>

  <script>
    let currentSortCol = -1;
    let sortAsc = true;

    function applyFilters() {
      const q = (document.getElementById('searchInput').value || '').toLowerCase().trim();
      const status = document.getElementById('statusFilter').value;
      const type = document.getElementById('typeFilter').value;
      const rows = document.querySelectorAll('#tableBody tr.data-row');
      let visibleCount = 0;

      rows.forEach(function(row) {
        const rowStatus = row.getAttribute('data-status');
        const rowType = row.getAttribute('data-type');
        const text = row.innerText.toLowerCase();

        const matchSearch = !q || text.includes(q);
        const matchStatus = (status === 'ALL') || (rowStatus === status);
        const matchType = (type === 'ALL') || (rowType === type);

        if (matchSearch && matchStatus && matchType) {
          row.style.display = '';
          visibleCount++;
        } else {
          row.style.display = 'none';
        }
      });

      const countEl = document.getElementById('resultsCount');
      if (countEl) {
        countEl.innerText = '${isEn ? 'Showing ' : 'Hiển thị '}' + visibleCount + ' / ${records.length}' + '${isEn ? ' clashes' : ' va chạm'}';
      }
    }

    function sortTable(colIndex) {
      const table = document.getElementById('clashTable');
      const tbody = document.getElementById('tableBody');
      const rows = Array.from(tbody.querySelectorAll('tr.data-row'));

      if (currentSortCol === colIndex) {
        sortAsc = !sortAsc;
      } else {
        currentSortCol = colIndex;
        sortAsc = true;
      }

      rows.sort(function(a, b) {
        const aCell = (a.cells[colIndex] ? a.cells[colIndex].innerText : '').trim();
        const bCell = (b.cells[colIndex] ? b.cells[colIndex].innerText : '').trim();

        const aNum = parseFloat(aCell);
        const bNum = parseFloat(bCell);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortAsc ? aNum - bNum : bNum - aNum;
        }
        return sortAsc ? aCell.localeCompare(bCell, 'vi') : bCell.localeCompare(aCell, 'vi');
      });

      rows.forEach(function(row) { tbody.appendChild(row); });
    }
  </script>
</body>
</html>`;
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

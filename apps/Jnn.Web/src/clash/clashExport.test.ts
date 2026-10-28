import { describe, it, expect, vi } from 'vitest';
import { Workbook } from 'exceljs';
import {
  escapeCsvField,
  escapeHtml,
  exportClashCSV,
  exportClashExcel,
  exportClashHTML,
  downloadFile,
  CSV_HEADERS,
} from './clashExport';
import type { ClashTestItem } from './clashState';
import type { ClashRecord } from './clashResults';

/**
 * Standard RFC 4180 CSV parser for testing purposes.
 * Handles quoted fields, escaped quotes (""), and multiline content.
 */
function parseCsv(csvText: string): string[][] {
  // Strip BOM if present
  const text = csvText.startsWith('\uFEFF') ? csvText.slice(1) : csvText;
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++; // skip \n
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

describe('clashExport - CSV & Excel Export (T15.1, T15.2)', () => {
  const mockRecords: ClashRecord[] = [
    {
      clashId: 'c1',
      testId: 't1',
      name: 'Clash 1',
      status: 'New',
      type: 'Hard',
      distance: 0.0,
      aId: '101',
      bId: '201',
      aGuid: 'guid-beam-1',
      bGuid: 'guid-col-1',
      aName: 'Dầm B200x400 Tầng 2',
      bName: 'Cột C300x300 Tầng 2',
      aClass: 'IfcBeam',
      bClass: 'IfcColumn',
      aStorey: 'Tầng 2',
      bStorey: 'Tầng 2',
      point: [10.5, 20.25, 3.8],
      firstFoundAt: 1000,
      lastFoundAt: 2000,
      comments: 'Cần hạ cao độ đáy dầm 50mm, tránh cốt thép cột',
      assignedTo: 'Kỹ sư Kết cấu',
    },
    {
      clashId: 'c2',
      testId: 't1',
      name: 'Clash 2',
      status: 'Active',
      type: 'Clearance',
      distance: 0.045123,
      aId: '102',
      bId: '202',
      aGuid: 'guid-pipe-1',
      bGuid: 'guid-wall-1',
      aName: 'Ống cấp nước D60',
      bName: 'Tường bê tông 200',
      aClass: 'IfcPipeSegment',
      bClass: 'IfcWall',
      aStorey: 'Tầng 1',
      bStorey: 'Tầng 1',
      point: [5.0, 12.0, 2.5],
      firstFoundAt: 1000,
      lastFoundAt: 2000,
      comments: 'Khoảng hở 45mm < 50mm quy định.\nĐã báo bên MEP xử lý lại tuyến ống.',
      assignedTo: 'MEP Coordinator',
    },
    {
      clashId: 'c3',
      testId: 't1',
      name: 'Clash 3',
      status: 'Reviewed',
      type: 'Duplicates',
      distance: 0.0,
      aId: '103',
      bId: '203',
      aGuid: 'guid-slab-dup-1',
      bGuid: 'guid-slab-dup-2',
      aName: 'Sàn S1',
      bName: 'Sàn S1 copy',
      aClass: 'IfcSlab',
      bClass: 'IfcSlab',
      aStorey: 'Mái',
      point: [0.0, 0.0, 15.0],
      firstFoundAt: 1000,
      lastFoundAt: 2000,
      comments: 'Hai tấm sàn vẽ đè lên nhau, "xóa" bản sao 203.',
      assignedTo: 'BIM Modeler',
    },
    {
      clashId: 'c4',
      testId: 't1',
      name: 'Clash 4',
      status: 'Approved',
      type: 'Hard',
      distance: 0.0,
      aId: '104',
      bId: '204',
      aGuid: 'guid-beam-4',
      bGuid: 'guid-wall-4',
      aName: 'Dầm bo',
      bName: 'Vách thang máy',
      aClass: 'IfcBeam',
      bClass: 'IfcWall',
      aStorey: 'Tầng 3',
      point: [18.2, 5.4, 7.2],
      firstFoundAt: 1000,
      lastFoundAt: 2000,
      comments: 'Gối tựa dầm đúc liền vách, chấp nhận giao nhau.',
      assignedTo: 'Trưởng nhóm',
    },
    {
      clashId: 'c5',
      testId: 't1',
      name: 'Clash 5',
      status: 'Resolved',
      type: 'Hard',
      distance: 0.0,
      aId: '105',
      bId: '205',
      aGuid: 'guid-duct-1',
      bGuid: 'guid-beam-5',
      aName: 'Ống gió 500x300',
      bName: 'Dầm chính D2',
      aClass: 'IfcDuctSegment',
      bClass: 'IfcBeam',
      aStorey: 'Tầng Hầm',
      point: [3.5, 8.0, -2.5],
      firstFoundAt: 1000,
      lastFoundAt: 2000,
      comments: 'Đã mở lỗ sleeve xuyên dầm theo RFI #12.',
      assignedTo: 'Kỹ sư Giám sát',
    },
  ];

  const mockTest: ClashTestItem = {
    id: 'test-1',
    name: 'Kiểm tra Kết cấu x MEP',
    type: 'Hard',
    tolerance: 0.005,
    selectionA: { ifcClass: 'IfcBeam' },
    selectionB: { ifcClass: 'IfcColumn' },
    status: 'completed',
    records: mockRecords,
  };

  describe('escapeCsvField', () => {
    it('returns empty string for null and undefined', () => {
      expect(escapeCsvField(null)).toBe('');
      expect(escapeCsvField(undefined)).toBe('');
    });

    it('returns numbers and clean strings as is', () => {
      expect(escapeCsvField(123)).toBe('123');
      expect(escapeCsvField(0)).toBe('0');
      expect(escapeCsvField('IfcBeam')).toBe('IfcBeam');
    });

    it('escapes fields with commas, quotes, and newlines', () => {
      expect(escapeCsvField('hello, world')).toBe('"hello, world"');
      expect(escapeCsvField('quote "test" here')).toBe('"quote ""test"" here"');
      expect(escapeCsvField('line 1\nline 2')).toBe('"line 1\nline 2"');
      expect(escapeCsvField('line 1\r\nline 2')).toBe('"line 1\r\nline 2"');
    });
  });

  describe('exportClashCSV', () => {

    it('begins with UTF-8 BOM byte marker (\\uFEFF)', () => {
      const csv = exportClashCSV(mockTest);
      expect(csv.charCodeAt(0)).toBe(0xfeff);
    });

    it('exports all 5 mock records with 1 header row (6 rows total)', () => {
      const csv = exportClashCSV(mockTest);
      const rows = parseCsv(csv);

      expect(rows).toHaveLength(6);
      expect(rows[0]).toEqual(CSV_HEADERS);
      expect(rows[0]).toHaveLength(15);
    });

    it('correctly formats and preserves complex comments with commas, quotes, and newlines', () => {
      const csv = exportClashCSV(mockTest);
      const rows = parseCsv(csv);

      // Check row 2 (Clash 2 with multiline comment)
      const row2 = rows[2]!;
      expect(row2[1]).toBe('c2');
      expect(row2[2]).toBe('Active');
      expect(row2[3]).toBe('Clearance');
      expect(row2[4]).toBe('0.045123'); // 6 decimals
      expect(row2[5]).toBe('guid-pipe-1');
      expect(row2[6]).toBe('Ống cấp nước D60');
      expect(row2[13]).toBe('Khoảng hở 45mm < 50mm quy định.\nĐã báo bên MEP xử lý lại tuyến ống.');
      expect(row2[14]).toBe('MEP Coordinator');

      // Check row 3 (Clash 3 with quote in comment)
      const row3 = rows[3]!;
      expect(row3[13]).toBe('Hai tấm sàn vẽ đè lên nhau, "xóa" bản sao 203.');

      // Check row 1 (Clash 1 point coordinate)
      const row1 = rows[1]!;
      expect(row1[12]).toBe('10.500, 20.250, 3.800');
    });

    it('handles tests with 0 clash records cleanly', () => {
      const emptyTest: ClashTestItem = {
        ...mockTest,
        records: [],
      };
      const csv = exportClashCSV(emptyTest);
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(CSV_HEADERS);
    });
  });

  describe('downloadFile', () => {
    it('creates an anchor, triggers click, and revokes object URL', () => {
      const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
      const revokeObjectURLMock = vi.fn();
      globalThis.URL.createObjectURL = createObjectURLMock;
      globalThis.URL.revokeObjectURL = revokeObjectURLMock;

      const clickMock = vi.fn();
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName === 'a') {
          el.click = clickMock;
        }
        return el;
      });

      downloadFile('test,content', 'test.csv', 'text/csv');

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  describe('exportClashExcel (T15.2)', () => {
    it('exports a valid .xlsx Blob and reads back correctly with ExcelJS', async () => {
      const blob = await exportClashExcel(mockTest);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(blob.size).toBeGreaterThan(1000);

      // Read back workbook using ExcelJS
      const buffer = await blob.arrayBuffer();
      const readWb = new Workbook();
      await readWb.xlsx.load(buffer);

      // 1. Check sheets count and names
      expect(readWb.worksheets).toHaveLength(2);
      const sheetOverview = readWb.getWorksheet('Tổng quan');
      const sheetResults = readWb.getWorksheet('Kết quả');
      expect(sheetOverview).toBeDefined();
      expect(sheetResults).toBeDefined();

      // 2. Check Sheet 1 "Tổng quan" content
      const title = sheetOverview?.getCell('A1').value;
      expect(title).toBe('BÁO CÁO TỔNG QUAN CLASH DETECTION');

      // Check test metadata in Sheet 1
      let foundTestName = false;
      let foundTotal = false;
      sheetOverview?.eachRow((row) => {
        const p = String(row.getCell(1).value || '');
        if (p.includes('Tên kiểm tra')) {
          foundTestName = true;
          expect(row.getCell(2).value).toBe(mockTest.name);
        }
        if (p === 'Tổng số va chạm:') {
          foundTotal = true;
          expect(row.getCell(2).value).toBe(5);
        }
      });
      expect(foundTestName).toBe(true);
      expect(foundTotal).toBe(true);

      // 3. Check Sheet 2 "Kết quả" structure
      // Header row
      const headerRow = sheetResults?.getRow(1);
      expect(headerRow).toBeDefined();
      const headers = headerRow?.values as (string | undefined)[];
      // Note: exceljs row.values has index 0 undefined (1-based index)
      const nonNullHeaders = headers.filter(Boolean);
      expect(nonNullHeaders).toEqual(CSV_HEADERS);

      // Verify row count (1 header + 5 data rows = 6 rows)
      expect(sheetResults?.rowCount).toBe(6);

      // Verify row 2 (first clash record)
      const r2 = sheetResults?.getRow(2);
      expect(r2?.getCell(1).value).toBe(1);
      expect(r2?.getCell(2).value).toBe('c1');
      expect(r2?.getCell(3).value).toBe('New');
      expect(r2?.getCell(4).value).toBe('Hard');
      expect(r2?.getCell(6).value).toBe('guid-beam-1');
      expect(r2?.getCell(9).value).toBe('guid-col-1');
      expect(r2?.getCell(7).value).toBe('Dầm B200x400 Tầng 2');

      // Verify row 3 (second clash record: distance formatting)
      const r3 = sheetResults?.getRow(3);
      expect(r3?.getCell(5).value).toBe(0.045123);
      expect(r3?.getCell(5).numFmt).toBe('0.000000');
      expect(r3?.getCell(3).value).toBe('Active');

      // Verify freeze pane configuration (frozen at STT col & Header row)
      const views = sheetResults?.views;
      expect(views).toBeDefined();
      const firstView = views?.[0] as { state?: string; xSplit?: number; ySplit?: number } | undefined;
      expect(firstView?.state).toBe('frozen');
      expect(firstView?.xSplit).toBe(1);
      expect(firstView?.ySplit).toBe(1);

      // Verify autofilter definition
      expect(sheetResults?.autoFilter).toBeDefined();
    });

    it('handles tests with 0 clash records cleanly (valid empty workbook with header only)', async () => {
      const emptyTest: ClashTestItem = {
        ...mockTest,
        records: [],
      };
      const blob = await exportClashExcel(emptyTest);
      expect(blob.size).toBeGreaterThan(500);

      const buffer = await blob.arrayBuffer();
      const readWb = new Workbook();
      await readWb.xlsx.load(buffer);

      const sheetResults = readWb.getWorksheet('Kết quả');
      expect(sheetResults).toBeDefined();
      expect(sheetResults?.rowCount).toBe(1); // Only header row
    });
  });

  describe('escapeHtml', () => {
    it('escapes &, <, >, ", and single quotes', () => {
      expect(escapeHtml('<script>alert("xss")&\'test\'</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&amp;&#039;test&#039;&lt;/script&gt;',
      );
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
      expect(escapeHtml(123)).toBe('123');
    });
  });

  describe('exportClashHTML (T15.3)', () => {
    it('generates a valid, self-contained HTML document with exact rows and components', () => {
      const html = exportClashHTML(mockTest);

      // 1. Structure checks
      expect(html.trim().startsWith('<!DOCTYPE html>')).toBe(true);
      expect(html.includes('</html>')).toBe(true);
      expect(html.includes('<style>')).toBe(true);
      expect(html.includes('<script>')).toBe(true);
      // Ensure no external scripts or external CDNs
      expect(html.includes('<script src=')).toBe(false);
      expect(html.includes('<link rel="stylesheet"')).toBe(false);
      expect(html.includes('@media print')).toBe(true);

      // 2. Parse HTML using DOMParser
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Title & Header
      expect(doc.title).toContain('Kiểm tra Kết cấu x MEP');
      expect(doc.querySelector('h1')?.textContent).toBe('Kiểm tra Kết cấu x MEP');

      // Summary Cards Counts
      expect(doc.querySelector('.stat-total .count')?.textContent).toBe('5');
      expect(doc.querySelector('.stat-new .count')?.textContent).toBe('1');
      expect(doc.querySelector('.stat-active .count')?.textContent).toBe('1');
      expect(doc.querySelector('.stat-reviewed .count')?.textContent).toBe('1');
      expect(doc.querySelector('.stat-approved .count')?.textContent).toBe('1');
      expect(doc.querySelector('.stat-resolved .count')?.textContent).toBe('1');

      // Detailed Table Rows
      const dataRows = doc.querySelectorAll('#tableBody tr.data-row');
      expect(dataRows.length).toBe(5);

      // Verify row 1 content
      const firstRow = dataRows[0] as HTMLTableRowElement;
      expect(firstRow.cells[0]?.textContent?.trim()).toBe('1');
      expect(firstRow.cells[1]?.textContent?.trim()).toBe('c1');
      expect(firstRow.cells[2]?.textContent?.trim()).toBe('New');
      expect(firstRow.cells[3]?.textContent?.trim()).toBe('Hard');
      expect(firstRow.cells[4]?.textContent?.trim()).toBe('0.000000');
      expect(firstRow.cells[5]?.textContent?.trim()).toBe('guid-beam-1');
      expect(firstRow.cells[6]?.textContent?.trim()).toBe('Dầm B200x400 Tầng 2');
      expect(firstRow.cells[7]?.textContent?.trim()).toBe('IfcBeam');
      expect(firstRow.cells[8]?.textContent?.trim()).toBe('guid-col-1');
      expect(firstRow.cells[9]?.textContent?.trim()).toBe('Cột C300x300 Tầng 2');
      expect(firstRow.cells[10]?.textContent?.trim()).toBe('IfcColumn');
      expect(firstRow.cells[11]?.textContent?.trim()).toBe('Tầng 2');
      expect(firstRow.cells[12]?.textContent?.trim()).toBe('10.500, 20.250, 3.800');

      // Verify row 2 (multiline and special characters preserved)
      const secondRow = dataRows[1] as HTMLTableRowElement;
      expect(secondRow.cells[4]?.textContent?.trim()).toBe('0.045123');
      expect(secondRow.cells[13]?.textContent).toContain('Khoảng hở 45mm < 50mm quy định.');
    });

    it('handles tests with 0 clash records cleanly (empty table body)', () => {
      const emptyTest: ClashTestItem = {
        ...mockTest,
        records: [],
      };
      const html = exportClashHTML(emptyTest);
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      expect(doc.querySelector('.stat-total .count')?.textContent).toBe('0');
      const dataRows = doc.querySelectorAll('#tableBody tr.data-row');
      expect(dataRows.length).toBe(0);
    });
  });
});

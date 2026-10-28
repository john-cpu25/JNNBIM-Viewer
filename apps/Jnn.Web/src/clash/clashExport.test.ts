import { describe, it, expect, vi } from 'vitest';
import {
  escapeCsvField,
  exportClashCSV,
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

describe('clashExport - CSV Export (T15.1)', () => {
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
});

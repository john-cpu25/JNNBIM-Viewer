import { describe, it, expect } from 'vitest';
import * as OBC from '@thatopen/components';
import JSZip from 'jszip';
import {
  setupBcfManager,
  clashToBcfTopic,
  exportSingleClashToBCF,
  exportClashTestToBCF,
  importBCFToClashResults,
} from './bcfExport';
import type { ClashRecord } from './clashResults';
import type { ClashTestItem } from './clashState';
import type { JnnElement } from '../domain/model';

describe('bcfExport - BCFTopics API Survey & Export (T16.1)', () => {
  const mockTest: ClashTestItem = {
    id: 'test-1',
    name: 'Kiểm tra Kết cấu x Kiến trúc',
    type: 'Hard',
    tolerance: 0.005,
    selectionA: { ifcClass: 'IfcBeam' },
    selectionB: { ifcClass: 'IfcColumn' },
    status: 'completed',
  };

  const mockClash: ClashRecord = {
    clashId: 'clash-101',
    testId: 'test-1',
    name: 'Clash 1',
    status: 'New',
    type: 'Hard',
    distance: 0.0,
    aId: '101',
    bId: '201',
    aGuid: '1B_beam_guid_4567',
    bGuid: '2C_column_guid_8901',
    aName: 'Dầm B300x600 Tầng 2',
    bName: 'Cột C400x400 Tầng 2',
    aClass: 'IfcBeam',
    bClass: 'IfcColumn',
    aStorey: 'Tầng 2',
    point: [12.5, 8.0, 3.6],
    firstFoundAt: 1000,
    lastFoundAt: 2000,
    comments: 'Xung đột dầm bê tông cốt thép xuyên qua cột biên',
    assignedTo: 'Kỹ sư Kết cấu',
  };

  it('correctly sets up BCFTopics with version 2.1 and default author', () => {
    const components = new OBC.Components();
    const bcf = setupBcfManager(components, { author: 'nhan@jnn.vn' });

    expect(bcf).toBeDefined();
    expect(bcf.config.version).toBe('2.1');
    expect(bcf.config.author).toBe('nhan@jnn.vn');
    expect(bcf.config.fallbackVersionOnImport).toBe('2.1');
  });

  it('maps ClashRecord into a valid BCF Topic with priority, stage, and labels', () => {
    const components = new OBC.Components();
    const topic = clashToBcfTopic(mockClash, mockTest, components);

    expect(topic.title).toBe('Clash: Dầm B300x600 Tầng 2 × Cột C400x400 Tầng 2');
    expect(topic.type).toBe('Clash');
    expect(topic.priority).toBe('Critical'); // Hard -> Critical
    expect(topic.stage).toBe('Active'); // New -> Active
    expect(topic.status).toBe('New');
    expect(topic.assignedTo).toBe('Kỹ sư Kết cấu');

    // Labels
    expect(topic.labels.has('JNN-Clash')).toBe(true);
    expect(topic.labels.has('Kiểm tra Kết cấu x Kiến trúc')).toBe(true);
    expect(topic.labels.has('Hard')).toBe(true);

    // Viewpoint attached
    expect(topic.viewpoints.size).toBe(1);
    const vpGuid = Array.from(topic.viewpoints)[0]!;
    const viewpoints = components.get(OBC.Viewpoints);
    const vp = viewpoints.list.get(vpGuid);

    expect(vp).toBeDefined();
    expect(vp?.selectionComponents.has('1B_beam_guid_4567')).toBe(true);
    expect(vp?.selectionComponents.has('2C_column_guid_8901')).toBe(true);
    expect(vp?.camera.camera_view_point.x).toBeCloseTo(15.0);
    expect(vp?.camera.camera_view_point.y).toBeCloseTo(10.5);
    expect(vp?.camera.camera_view_point.z).toBeCloseTo(5.6);
    expect(vp?.camera.camera_direction.x).toBeCloseTo(-2.5);
    expect(vp?.camera.camera_direction.y).toBeCloseTo(-2.5);
    expect(vp?.camera.camera_direction.z).toBeCloseTo(-2.0);

    // Comments attached
    expect(topic.comments.size).toBe(1);
  });

  it('calculates BCF viewpoint camera proportional to clash bounds (D5)', () => {
    const components = new OBC.Components();
    // Bounding box with dimensions: dx=2, dy=2, dz=1 -> diag=3 -> d = 1.5 * 3 = 4.5
    const clashWithBounds: ClashRecord = {
      ...mockClash,
      clashId: 'clash-bounds-1',
      boxOverlap: {
        min: [10, 20, 30],
        max: [12, 22, 31],
      },
    };

    const topic = clashToBcfTopic(clashWithBounds, mockTest, components);
    const vpGuid = Array.from(topic.viewpoints)[0]!;
    const viewpoints = components.get(OBC.Viewpoints);
    const vp = viewpoints.list.get(vpGuid);

    expect(vp).toBeDefined();

    const cx = 11;
    const cy = 21;
    const cz = 30.5;
    const dirLen = Math.hypot(-1, -1, -0.8);
    const dirX = -1 / dirLen;
    const dirY = -1 / dirLen;
    const dirZ = -0.8 / dirLen;
    const d = 4.5;

    // View direction should be normalized (-1, -1, -0.8)
    expect(vp?.camera.camera_direction.x).toBeCloseTo(dirX, 5);
    expect(vp?.camera.camera_direction.y).toBeCloseTo(dirY, 5);
    expect(vp?.camera.camera_direction.z).toBeCloseTo(dirZ, 5);

    // Camera view point = center - dir * d
    expect(vp?.camera.camera_view_point.x).toBeCloseTo(cx - dirX * d, 5);
    expect(vp?.camera.camera_view_point.y).toBeCloseTo(cy - dirY * d, 5);
    expect(vp?.camera.camera_view_point.z).toBeCloseTo(cz - dirZ * d, 5);
  });

  it('clamps minimum camera distance to 2 for small clash bounds (D5)', () => {
    const components = new OBC.Components();
    // dx=0.1, dy=0.1, dz=0.1 -> diag ≈ 0.173 -> 1.5 * diag ≈ 0.26 < 2 -> d = 2
    const clashSmallBounds: ClashRecord = {
      ...mockClash,
      clashId: 'clash-bounds-small',
      boxOverlap: {
        min: [0, 0, 0],
        max: [0.1, 0.1, 0.1],
      },
    };

    const topic = clashToBcfTopic(clashSmallBounds, mockTest, components);
    const vpGuid = Array.from(topic.viewpoints)[0]!;
    const viewpoints = components.get(OBC.Viewpoints);
    const vp = viewpoints.list.get(vpGuid);

    expect(vp).toBeDefined();

    const cx = 0.05;
    const cy = 0.05;
    const cz = 0.05;
    const dirLen = Math.hypot(-1, -1, -0.8);
    const dirX = -1 / dirLen;
    const dirY = -1 / dirLen;
    const dirZ = -0.8 / dirLen;
    const d = 2.0;

    expect(vp?.camera.camera_direction.x).toBeCloseTo(dirX, 5);
    expect(vp?.camera.camera_direction.y).toBeCloseTo(dirY, 5);
    expect(vp?.camera.camera_direction.z).toBeCloseTo(dirZ, 5);
    expect(vp?.camera.camera_view_point.x).toBeCloseTo(cx - dirX * d, 5);
    expect(vp?.camera.camera_view_point.y).toBeCloseTo(cy - dirY * d, 5);
    expect(vp?.camera.camera_view_point.z).toBeCloseTo(cz - dirZ * d, 5);
  });

  it('exports a single clash record into a valid BCF zip file with version, markup, and viewpoint', async () => {
    const blob = await exportSingleClashToBCF(mockClash, mockTest);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1500);

    const arrayBuffer = await blob.arrayBuffer();
    const zip = new JSZip();
    await zip.loadAsync(arrayBuffer);

    const filenames = Object.keys(zip.files);

    // 1. bcf.version exists
    expect(filenames).toContain('bcf.version');
    const versionFile = zip.file('bcf.version');
    expect(versionFile).not.toBeNull();
    const versionXml = await versionFile!.async('string');
    expect(versionXml).toContain('VersionId="2.1"');

    // 2. extensions.xml exists
    expect(filenames).toContain('extensions.xml');

    // 3. Topic folder containing markup.bcf and viewpoint.bcfv
    const markupFile = filenames.find((f) => f.endsWith('markup.bcf'));
    expect(markupFile).toBeDefined();
    const markupXml = await zip.file(markupFile!)!.async('string');
    expect(markupXml).toContain('Dầm B300x600 Tầng 2');
    expect(markupXml).toContain('Cột C400x400 Tầng 2');

    const viewpointFile = filenames.find((f) => f.endsWith('.bcfv'));
    expect(viewpointFile).toBeDefined();
    const viewpointXml = await zip.file(viewpointFile!)!.async('string');
    expect(viewpointXml).toContain('1B_beam_guid_4567');
    expect(viewpointXml).toContain('2C_column_guid_8901');
  });

  it('imports back the exported BCF zip via BCFTopics.load without error', async () => {
    const components = new OBC.Components();
    const bcf = setupBcfManager(components);

    const blob = await exportSingleClashToBCF(mockClash, mockTest, components);
    const arrayBuffer = await blob.arrayBuffer();

    const result = await bcf.load(new Uint8Array(arrayBuffer));
    expect(result.topics.length).toBeGreaterThanOrEqual(1);
    expect(result.viewpoints.length).toBeGreaterThanOrEqual(1);

    const importedTopic = result.topics[0]!;
    expect(importedTopic.title).toContain('Clash: Dầm B300x600 Tầng 2 × Cột C400x400 Tầng 2');

    const importedVp = result.viewpoints[0]!;
    const selGuids = Array.from(importedVp.selectionComponents);
    expect(selGuids).toContain('1B_beam_guid_4567');
    expect(selGuids).toContain('2C_column_guid_8901');
  });

  describe('exportClashTestToBCF (T16.2)', () => {
    const tenClashes: ClashRecord[] = Array.from({ length: 10 }, (_, i) => ({
      clashId: `clash-${i + 1}`,
      testId: 'test-1',
      name: `Clash ${i + 1}`,
      // 6 New/Active and 4 Resolved
      status: i < 6 ? (i % 2 === 0 ? 'New' : 'Active') : 'Resolved',
      type: i % 3 === 0 ? 'Hard' : i % 3 === 1 ? 'Clearance' : 'Duplicates',
      distance: 0.01 * i,
      aId: `el-a-${i}`,
      bId: `el-b-${i}`,
      aGuid: `guid-a-${i}`,
      bGuid: `guid-b-${i}`,
      aName: `Element A ${i}`,
      bName: `Element B ${i}`,
      point: [i, i * 2, 3] as [number, number, number],
      firstFoundAt: 1000,
      lastFoundAt: 2000,
      comments: `Ghi chú cho clash ${i + 1}`,
    }));

    const testWithTenClashes: ClashTestItem = {
      ...mockTest,
      records: tenClashes,
    };

    it('exports all 10 clash records into BCF archive containing exactly 10 markup files', async () => {
      const blob = await exportClashTestToBCF(testWithTenClashes);
      expect(blob).toBeInstanceOf(Blob);

      const arrayBuffer = await blob.arrayBuffer();
      const zip = new JSZip();
      await zip.loadAsync(arrayBuffer);

      const filenames = Object.keys(zip.files);
      const markups = filenames.filter((f) => f.endsWith('markup.bcf'));
      expect(markups).toHaveLength(10);

      const viewpoints = filenames.filter((f) => f.endsWith('.bcfv'));
      expect(viewpoints).toHaveLength(10);
    });

    it('filters out Resolved clashes when onlyActive: true is requested (exports 6 topics)', async () => {
      const blob = await exportClashTestToBCF(testWithTenClashes, undefined, { onlyActive: true });
      const arrayBuffer = await blob.arrayBuffer();
      const zip = new JSZip();
      await zip.loadAsync(arrayBuffer);

      const filenames = Object.keys(zip.files);
      const markups = filenames.filter((f) => f.endsWith('markup.bcf'));
      expect(markups).toHaveLength(6);
    });

    it('handles test with 0 clashes cleanly (produces valid BCF archive with 0 topics)', async () => {
      const emptyTest: ClashTestItem = {
        ...mockTest,
        records: [],
      };

      const blob = await exportClashTestToBCF(emptyTest);
      expect(blob).toBeInstanceOf(Blob);

      const arrayBuffer = await blob.arrayBuffer();
      const zip = new JSZip();
      await zip.loadAsync(arrayBuffer);

      const filenames = Object.keys(zip.files);
      expect(filenames).toContain('bcf.version');
      expect(filenames).toContain('extensions.xml');

      const markups = filenames.filter((f) => f.endsWith('markup.bcf'));
      expect(markups).toHaveLength(0);
    });
  });

  describe('importBCFToClashResults (T16.3)', () => {
    const fiveClashes: ClashRecord[] = [
      {
        clashId: 'c-1',
        testId: 'test-1',
        name: 'Clash Dầm 1 x Cột 1',
        status: 'New',
        type: 'Hard',
        distance: 0.0,
        aId: 'el-1',
        bId: 'el-2',
        aGuid: 'guid-beam-01',
        bGuid: 'guid-col-01',
        aName: 'Dầm B300x500',
        bName: 'Cột C400x400',
        aClass: 'IfcBeam',
        bClass: 'IfcColumn',
        point: [10, 20, 3],
        firstFoundAt: 1000,
        lastFoundAt: 2000,
        comments: 'Giao thoa dầm và cột tầng 2',
      },
      {
        clashId: 'c-2',
        testId: 'test-1',
        name: 'Clash Ống x Sàn',
        status: 'Active',
        type: 'Clearance',
        distance: 0.035,
        aId: 'el-3',
        bId: 'el-4',
        aGuid: 'guid-pipe-01',
        bGuid: 'guid-slab-01',
        aName: 'Ống D90',
        bName: 'Sàn S150',
        point: [15, 25, 4],
        firstFoundAt: 1000,
        lastFoundAt: 2000,
        comments: 'Khoảng hở 35mm < 50mm',
      },
      {
        clashId: 'c-3',
        testId: 'test-1',
        name: 'Clash Tường x Vách',
        status: 'Reviewed',
        type: 'Duplicates',
        distance: 0.0,
        aId: 'el-5',
        bId: 'el-6',
        aGuid: 'guid-wall-01',
        bGuid: 'guid-wall-02',
        aName: 'Tường gạch 200',
        bName: 'Vách bê tông',
        point: [5, 10, 1],
        firstFoundAt: 1000,
        lastFoundAt: 2000,
        comments: 'Vẽ trùng',
      },
      {
        clashId: 'c-4',
        testId: 'test-1',
        name: 'Clash Dầm x Vách',
        status: 'Approved',
        type: 'Hard',
        distance: 0.0,
        aId: 'el-7',
        bId: 'el-8',
        aGuid: 'guid-beam-02',
        bGuid: 'guid-wall-03',
        point: [2, 4, 6],
        firstFoundAt: 1000,
        lastFoundAt: 2000,
      },
      {
        clashId: 'c-5',
        testId: 'test-1',
        name: 'Clash Ống gió x Dầm',
        status: 'Resolved',
        type: 'Hard',
        distance: 0.0,
        aId: 'el-9',
        bId: 'el-10',
        aGuid: 'guid-duct-01',
        bGuid: 'guid-beam-03',
        point: [1, 2, 3],
        firstFoundAt: 1000,
        lastFoundAt: 2000,
        comments: 'Đã mở sleeve',
      },
    ];

    const testForRoundTrip: ClashTestItem = {
      ...mockTest,
      name: 'Test Roundtrip BCF',
      records: fiveClashes,
    };

    const mockElementsMap = new Map<string, Pick<JnnElement, 'id'> & Partial<JnnElement>>([
      [
        'guid-beam-01',
        {
          id: 'el-1',
          name: 'Dầm B300x500',
          category: 'IfcBeam',
          modelId: 'm1',
          globalId: 'guid-beam-01',
        },
      ],
      [
        'guid-col-01',
        {
          id: 'el-2',
          name: 'Cột C400x400',
          category: 'IfcColumn',
          modelId: 'm1',
          globalId: 'guid-col-01',
        },
      ],
      [
        'guid-pipe-01',
        {
          id: 'el-3',
          name: 'Ống D90',
          category: 'IfcPipeSegment',
          modelId: 'm2',
          globalId: 'guid-pipe-01',
        },
      ],
      [
        'guid-slab-01',
        {
          id: 'el-4',
          name: 'Sàn S150',
          category: 'IfcSlab',
          modelId: 'm1',
          globalId: 'guid-slab-01',
        },
      ],
      [
        'guid-wall-01',
        {
          id: 'el-5',
          name: 'Tường gạch 200',
          category: 'IfcWall',
          modelId: 'm1',
          globalId: 'guid-wall-01',
        },
      ],
      [
        'guid-wall-02',
        {
          id: 'el-6',
          name: 'Vách bê tông',
          category: 'IfcWall',
          modelId: 'm1',
          globalId: 'guid-wall-02',
        },
      ],
      [
        'guid-beam-02',
        {
          id: 'el-7',
          name: 'Dầm B2',
          category: 'IfcBeam',
          modelId: 'm1',
          globalId: 'guid-beam-02',
        },
      ],
      [
        'guid-wall-03',
        {
          id: 'el-8',
          name: 'Vách W3',
          category: 'IfcWall',
          modelId: 'm1',
          globalId: 'guid-wall-03',
        },
      ],
      [
        'guid-duct-01',
        {
          id: 'el-9',
          name: 'Ống gió 500x300',
          category: 'IfcDuctSegment',
          modelId: 'm2',
          globalId: 'guid-duct-01',
        },
      ],
      [
        'guid-beam-03',
        {
          id: 'el-10',
          name: 'Dầm B3',
          category: 'IfcBeam',
          modelId: 'm1',
          globalId: 'guid-beam-03',
        },
      ],
    ]);

    it('performs round-trip: exports 5 clashes to BCF and imports back to exact 5 records with matching GUIDs', async () => {
      const blob = await exportClashTestToBCF(testForRoundTrip);
      const arrayBuffer = await blob.arrayBuffer();

      const imported = await importBCFToClashResults(new Uint8Array(arrayBuffer), undefined, {
        guidToElementMap: mockElementsMap,
        testId: 'test-1',
      });

      expect(imported).toHaveLength(5);

      // Verify records and GUIDs preservation
      const importedRecords = imported.map((i) => i.record);
      const importedAGuids = importedRecords.map((r) => r.aGuid);
      const importedBGuids = importedRecords.map((r) => r.bGuid);

      expect(importedAGuids).toContain('guid-beam-01');
      expect(importedBGuids).toContain('guid-col-01');

      // Check first clash details
      const firstClash = importedRecords.find((r) => r.aGuid === 'guid-beam-01');
      expect(firstClash).toBeDefined();
      expect(firstClash?.status).toBe('New');
      expect(firstClash?.type).toBe('Hard');
      expect(firstClash?.aName).toBe('Dầm B300x500');
      expect(firstClash?.bName).toBe('Cột C400x400');
      expect(firstClash?.comments).toContain('Giao thoa dầm và cột tầng 2');

      // Check clearance clash
      const secondClash = importedRecords.find((r) => r.aGuid === 'guid-pipe-01');
      expect(secondClash).toBeDefined();
      expect(secondClash?.type).toBe('Clearance');
      expect(secondClash?.distance).toBeCloseTo(0.035);

      // No missing element warnings when all elements exist in map
      expect(imported.every((i) => i.warning === undefined)).toBe(true);
    });

    it('handles BCF import with non-existent GUIDs gracefully with warning', async () => {
      const blob = await exportClashTestToBCF(testForRoundTrip);
      const arrayBuffer = await blob.arrayBuffer();

      // Empty elements map (simulates foreign model or missing elements)
      const emptyMap = new Map<string, JnnElement>();

      const imported = await importBCFToClashResults(new Uint8Array(arrayBuffer), undefined, {
        guidToElementMap: emptyMap,
      });

      expect(imported).toHaveLength(5);
      // All items should have warnings about missing elements
      expect(imported.every((i) => i.warning !== undefined)).toBe(true);
      expect(imported[0]!.warning).toContain('không tìm thấy trong mô hình hiện tại');
      // But GUIDs and titles are still correctly recovered
      expect(imported[0]!.record.aGuid).toBeDefined();
    });

    it('throws descriptive error on corrupted or invalid BCF binary data', async () => {
      const corruptedBytes = new Uint8Array([0, 1, 2, 3, 4, 5]);

      await expect(importBCFToClashResults(corruptedBytes)).rejects.toThrow(
        /File BCF không hợp lệ/,
      );
    });
  });
});

import { describe, it, expect } from 'vitest';
import * as OBC from '@thatopen/components';
import JSZip from 'jszip';
import {
  setupBcfManager,
  clashToBcfTopic,
  exportSingleClashToBCF,
  exportClashTestToBCF,
} from './bcfExport';
import type { ClashRecord } from './clashResults';
import type { ClashTestItem } from './clashState';

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
});

import * as OBC from '@thatopen/components';
import type { ClashRecord, ClashStatus } from './clashResults';
import type { ClashTestItem } from './clashState';
import type { ClashType } from './narrowphase';
import type { JnnElement } from '../domain/model';

/**
 * Initializes and configures the BCFTopics manager for consistent BCF 2.1 operations.
 */
export function setupBcfManager(
  components: OBC.Components,
  options: { author?: string; version?: OBC.BCFVersion } = {},
): OBC.BCFTopics {
  const bcf = components.get(OBC.BCFTopics);
  bcf.setup({
    author: options.author || 'jnn-viewer@jnn.vn',
    version: options.version || '2.1',
    fallbackVersionOnImport: '2.1',
  });
  // Ensure config properties are directly populated
  bcf.config.version = options.version || '2.1';
  bcf.config.fallbackVersionOnImport = '2.1';
  if (options.author) {
    bcf.config.author = options.author;
  }
  return bcf;
}

/**
 * Maps a ClashRecord into a BCF Topic with associated 3D Viewpoint and component GUIDs.
 */
export function clashToBcfTopic(
  clash: ClashRecord,
  test: ClashTestItem,
  components: OBC.Components,
): OBC.Topic {
  const bcf = setupBcfManager(components);

  // Priority mapping based on clash type
  let priority = 'Normal';
  if (clash.type === 'Hard') priority = 'Critical';
  else if (clash.type === 'Clearance') priority = 'Normal';
  else if (clash.type === 'Duplicates') priority = 'Minor';

  // Stage mapping based on status
  let stage = 'Active';
  if (clash.status === 'New') stage = 'Active';
  else if (clash.status === 'Active') stage = 'Active';
  else if (clash.status === 'Reviewed') stage = 'In Review';
  else if (clash.status === 'Approved') stage = 'Approved';
  else if (clash.status === 'Resolved') stage = 'Closed';

  const labels = new Set<string>(['JNN-Clash', test.name || 'ClashTest', clash.type]);

  const descParts: string[] = [
    `Loại: ${clash.type}`,
    `Khoảng cách: ${clash.distance !== undefined ? clash.distance.toFixed(6) : '0.000000'}m`,
    `Trạng thái: ${clash.status}`,
  ];
  if (clash.aName || clash.bName) {
    descParts.push(`Phần tử A: ${clash.aName || ''} (${clash.aGuid || ''})`);
    descParts.push(`Phần tử B: ${clash.bName || ''} (${clash.bGuid || ''})`);
  }
  if (clash.comments) {
    descParts.push(`Ghi chú: ${clash.comments}`);
  }

  const title = `Clash: ${clash.aName || 'Phần tử A'} × ${clash.bName || 'Phần tử B'}`;

  // Create BCF topic
  const topic = bcf.create({
    title,
    description: descParts.join(' | '),
    type: 'Clash',
    status: clash.status,
    priority,
    stage,
    assignedTo: clash.assignedTo || undefined,
    labels,
  });

  // Create and associate Viewpoint
  const viewpoints = components.get(OBC.Viewpoints);
  const vp = viewpoints.create();

  if (clash.boxOverlap) {
    const box = clash.boxOverlap;
    const dx = box.max[0] - box.min[0];
    const dy = box.max[1] - box.min[1];
    const dz = box.max[2] - box.min[2];
    const diag = Math.hypot(dx, dy, dz);
    const d = Math.max(2, 1.5 * diag);

    const cx = (box.min[0] + box.max[0]) / 2;
    const cy = (box.min[1] + box.max[1]) / 2;
    const cz = (box.min[2] + box.max[2]) / 2;

    const dirLen = Math.hypot(-1, -1, -0.8);
    const dirX = -1 / dirLen;
    const dirY = -1 / dirLen;
    const dirZ = -0.8 / dirLen;

    vp.set({
      perspective_camera: {
        camera_view_point: {
          x: cx - dirX * d,
          y: cy - dirY * d,
          z: cz - dirZ * d,
        },
        camera_direction: {
          x: dirX,
          y: dirY,
          z: dirZ,
        },
        camera_up_vector: { x: 0, y: 0, z: 1 },
        field_of_view: 60,
        aspect_ratio: 1.0,
      },
    });
  } else if (clash.point) {
    const [px, py, pz] = clash.point;
    vp.set({
      perspective_camera: {
        camera_view_point: { x: px + 2.5, y: py + 2.5, z: pz + 2.0 },
        camera_direction: { x: -2.5, y: -2.5, z: -2.0 },
        camera_up_vector: { x: 0, y: 0, z: 1 },
        field_of_view: 60,
        aspect_ratio: 1.0,
      },
    });
  }

  // Add selection component GUIDs
  if (clash.aGuid) {
    vp.selectionComponents.add(clash.aGuid);
  }
  if (clash.bGuid) {
    vp.selectionComponents.add(clash.bGuid);
  }

  topic.viewpoints.add(vp.guid);

  // Add comment if present
  if (clash.comments) {
    topic.createComment(clash.comments, vp.guid);
  }

  return topic;
}

/**
 * Options for BCF export.
 */
export interface ExportBcfOptions {
  onlyActive?: boolean;
  author?: string;
}

/**
 * Exports all clash records in a ClashTestItem as a standard BCF 2.1 zip archive (.bcf).
 */
export async function exportClashTestToBCF(
  test: ClashTestItem,
  components?: OBC.Components,
  options?: ExportBcfOptions,
): Promise<Blob> {
  const comps = components ?? new OBC.Components();
  const bcf = setupBcfManager(comps, { author: options?.author });

  let records = test.records ?? [];
  if (options?.onlyActive) {
    records = records.filter((r) => r.status !== 'Resolved');
  }

  if (records.length > 500) {
    console.warn(
      `[bcfExport] Số lượng va chạm lớn (${records.length} topics). Dung lượng file BCF có thể lớn.`,
    );
  }

  const topics: OBC.Topic[] = [];
  for (const record of records) {
    const topic = clashToBcfTopic(record, test, comps);
    topics.push(topic);
  }

  return bcf.export(topics);
}

/**
 * Exports a single clash record as a valid BCF zip Blob.
 */
export async function exportSingleClashToBCF(
  clash: ClashRecord,
  test: ClashTestItem,
  components?: OBC.Components,
): Promise<Blob> {
  const comps = components ?? new OBC.Components();
  const bcf = setupBcfManager(comps);
  const topic = clashToBcfTopic(clash, test, comps);
  return bcf.export([topic]);
}

/**
 * Result structure for imported BCF topic.
 */
export interface ImportedClashResult {
  record: ClashRecord;
  warning?: string;
}

/**
 * Options for BCF import.
 */
export interface ImportBcfOptions {
  guidToElementMap?: Map<string, Pick<JnnElement, 'id'> & Partial<JnnElement>>;
  testId?: string;
  locale?: 'vi' | 'en';
}

/**
 * Imports a BCF 2.1 zip file (.bcf) into structured ClashRecord objects.
 * Maps component GUIDs to current model elements when available.
 */
export async function importBCFToClashResults(
  bcfData: Uint8Array,
  components?: OBC.Components,
  options?: ImportBcfOptions,
): Promise<ImportedClashResult[]> {
  const comps = components ?? new OBC.Components();
  const bcf = setupBcfManager(comps);

  let loaded: { topics: OBC.Topic[]; viewpoints: OBC.Viewpoint[] };
  try {
    loaded = await bcf.load(bcfData);
  } catch (err) {
    throw new Error(`File BCF không hợp lệ hoặc không đúng định dạng: ${(err as Error).message}`);
  }

  const { topics } = loaded;
  const viewpointsManager = comps.get(OBC.Viewpoints);
  const results: ImportedClashResult[] = [];

  for (let idx = 0; idx < topics.length; idx++) {
    const topic = topics[idx]!;
    const warnings: string[] = [];

    // Extract viewpoints
    let aGuid = '';
    let bGuid = '';
    let point: [number, number, number] = [0, 0, 0];

    const vpGuids = Array.from(topic.viewpoints);
    if (vpGuids.length > 0) {
      const vp = viewpointsManager.list.get(vpGuids[0]!);
      if (vp) {
        const selGuids = Array.from(vp.selectionComponents);
        aGuid = selGuids[0] ?? '';
        bGuid = selGuids[1] ?? '';

        // Extract camera point
        if (vp.camera?.camera_view_point) {
          const cvp = vp.camera.camera_view_point;
          const cd = (vp.camera as any).camera_direction;
          if (cd) {
            point = [cvp.x + cd.x, cvp.y + cd.y, cvp.z + cd.z];
          } else {
            point = [cvp.x, cvp.y, cvp.z];
          }
        }
      }
    }

    // Map GUIDs to elements if map provided
    const elA = aGuid && options?.guidToElementMap ? options.guidToElementMap.get(aGuid) : undefined;
    const elB = bGuid && options?.guidToElementMap ? options.guidToElementMap.get(bGuid) : undefined;

    const isEn = options?.locale === 'en';
    if (aGuid && !elA && options?.guidToElementMap) {
      warnings.push(
        isEn
          ? `Element A (GUID: ${aGuid}) not found in the current model`
          : `Cấu kiện A (GUID: ${aGuid}) không tìm thấy trong mô hình hiện tại`,
      );
    }
    if (bGuid && !elB && options?.guidToElementMap) {
      warnings.push(
        isEn
          ? `Element B (GUID: ${bGuid}) not found in the current model`
          : `Cấu kiện B (GUID: ${bGuid}) không tìm thấy trong mô hình hiện tại`,
      );
    }

    // Status mapping
    const rawStatus = topic.status;
    let status: ClashStatus = 'New';
    if (['New', 'Active', 'Reviewed', 'Approved', 'Resolved'].includes(rawStatus)) {
      status = rawStatus as ClashStatus;
    } else if (rawStatus === 'Closed') {
      status = 'Resolved';
    } else if (rawStatus === 'In Review') {
      status = 'Reviewed';
    }

    // Type mapping from labels or description
    let type: ClashType = 'Hard';
    const labels = Array.from(topic.labels);
    if (labels.includes('Clearance') || (topic.description && topic.description.includes('Clearance'))) {
      type = 'Clearance';
    } else if (labels.includes('Duplicates') || (topic.description && topic.description.includes('Duplicates'))) {
      type = 'Duplicates';
    }

    // Distance mapping
    let distance = 0;
    if (topic.description) {
      const distMatch = topic.description.match(/Khoảng cách:\s*([\d.]+)/i);
      if (distMatch && distMatch[1]) {
        distance = parseFloat(distMatch[1]);
      }
    }

    // Extract comments
    let comments = '';
    const commentsList = Array.from(topic.comments.values());
    if (commentsList.length > 0 && commentsList[0]?.comment) {
      comments = commentsList.map((c) => c.comment).join('\n');
    }

    const record: ClashRecord = {
      clashId: topic.guid || `imported_bcf_${idx + 1}`,
      testId: options?.testId || 'imported_bcf_test',
      name: topic.title || `Clash ${idx + 1}`,
      status,
      type,
      distance,
      aId: elA?.id ?? aGuid ?? `ext_A_${idx + 1}`,
      bId: elB?.id ?? bGuid ?? `ext_B_${idx + 1}`,
      aGuid: aGuid || undefined,
      bGuid: bGuid || undefined,
      aName: elA?.name || undefined,
      bName: elB?.name || undefined,
      aClass: elA?.category || undefined,
      bClass: elB?.category || undefined,
      aStorey: elA?.storey || undefined,
      bStorey: elB?.storey || undefined,
      point,
      assignedTo: topic.assignedTo || undefined,
      comments: comments || undefined,
      firstFoundAt: topic.creationDate ? new Date(topic.creationDate).getTime() : Date.now(),
      lastFoundAt: topic.modifiedDate ? new Date(topic.modifiedDate).getTime() : Date.now(),
    };

    results.push({
      record,
      warning: warnings.length > 0 ? warnings.join('; ') : undefined,
    });
  }

  return results;
}

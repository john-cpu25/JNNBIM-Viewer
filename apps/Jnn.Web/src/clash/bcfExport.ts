import * as OBC from '@thatopen/components';
import type { ClashRecord } from './clashResults';
import type { ClashTestItem } from './clashState';

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

  if (clash.point) {
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

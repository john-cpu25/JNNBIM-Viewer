import type { ClashResult, ClashType } from './narrowphase';
import type { JnnElement } from '../domain/model';

export type ClashStatus = 'New' | 'Active' | 'Reviewed' | 'Approved' | 'Resolved';

export interface ClashRecord {
  clashId: string;
  testId: string;
  name: string;
  status: ClashStatus;
  type: ClashType;
  distance: number; // in meters (0 for Hard/Duplicates)
  aId: string | number;
  bId: string | number;
  aGuid?: string;
  bGuid?: string;
  aName?: string;
  bName?: string;
  aClass?: string;
  bClass?: string;
  aStorey?: string;
  bStorey?: string;
  point: [number, number, number];
  boxOverlap?: {
    min: [number, number, number];
    max: [number, number, number];
  };
  assignedTo?: string;
  comments?: string;
  firstFoundAt: number;
  lastFoundAt: number;
}

export interface MergeClashOptions {
  elementsMap?: Map<string, JnnElement>;
  now?: number;
}

/**
 * Merges previous clash records with newly computed raw clash results.
 * Applies standard Navisworks status lifecycle:
 * - Newly detected clash -> 'New'
 * - Previously 'New' or 'Active' that persists -> 'Active'
 * - User-reviewed or approved clashes preserve status unless reopened
 * - Previously detected clashes no longer present -> 'Resolved' (automatic)
 */
export function mergeClashResults(
  testId: string,
  previousRecords: ClashRecord[] = [],
  newResults: ClashResult[] = [],
  options: MergeClashOptions = {},
): ClashRecord[] {
  const now = options.now ?? Date.now();
  const elementsMap = options.elementsMap;

  const prevMap = new Map<string, ClashRecord>();
  for (const rec of previousRecords) {
    prevMap.set(rec.clashId, rec);
  }

  const currentClashIds = new Set<string>();
  const merged: ClashRecord[] = [];

  let nextIndex = previousRecords.length + 1;

  for (const res of newResults) {
    currentClashIds.add(res.clashId);
    const prev = prevMap.get(res.clashId);

    if (prev) {
      // Clash already existed
      let nextStatus: ClashStatus = prev.status;
      if (prev.status === 'New') {
        nextStatus = 'Active';
      } else if (prev.status === 'Resolved') {
        // Reopened clash
        nextStatus = 'Active';
      }

      merged.push({
        ...prev,
        distance: res.distance,
        point: res.point,
        boxOverlap: res.boxOverlap,
        status: nextStatus,
        lastFoundAt: now,
      });
    } else {
      // Brand new clash
      const elA = elementsMap ? elementsMap.get(String(res.aId)) : undefined;
      const elB = elementsMap ? elementsMap.get(String(res.bId)) : undefined;

      const record: ClashRecord = {
        clashId: res.clashId,
        testId,
        name: `Clash ${nextIndex++}`,
        status: 'New',
        type: res.type,
        distance: res.distance,
        aId: res.aId,
        bId: res.bId,
        aGuid: res.aGuid || elA?.globalId || undefined,
        bGuid: res.bGuid || elB?.globalId || undefined,
        aName: elA?.name || `Element ${res.aId}`,
        bName: elB?.name || `Element ${res.bId}`,
        aClass: elA?.category || (res.aGuid ? 'IfcElement' : undefined),
        bClass: elB?.category || (res.bGuid ? 'IfcElement' : undefined),
        aStorey: elA?.storey || undefined,
        bStorey: elB?.storey || undefined,
        point: res.point,
        boxOverlap: res.boxOverlap,
        firstFoundAt: now,
        lastFoundAt: now,
      };

      merged.push(record);
    }
  }

  // Handle old clashes no longer in newResults -> mark as Resolved
  for (const prev of previousRecords) {
    if (!currentClashIds.has(prev.clashId)) {
      merged.push({
        ...prev,
        status: 'Resolved',
      });
    }
  }

  // Sort by name or creation order
  return merged.sort((a, b) => {
    // Active & New first, Resolved last
    const order: Record<ClashStatus, number> = {
      New: 0,
      Active: 1,
      Reviewed: 2,
      Approved: 3,
      Resolved: 4,
    };
    if (order[a.status] !== order[b.status]) {
      return order[a.status] - order[b.status];
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

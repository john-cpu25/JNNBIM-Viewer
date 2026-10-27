import type { ClashResult, ClashType, NarrowphaseElement } from './narrowphase';
import { checkNarrowphasePair } from './narrowphase';
import { sweepAndPrune, type BoundingBoxItem, type CandidatePair } from './broadphase';

export interface ClashTestConfig {
  id: string;
  name: string;
  type: ClashType;
  tolerance: number; // in meters
  selectionA: Array<string | number>;
  selectionB: Array<string | number>;
  ignoreSameElement?: boolean;
  ignoreSameModel?: boolean;
}

export interface ClashProgress {
  testId: string;
  pairsChecked: number;
  totalCandidatePairs: number;
  percent: number;
  clashesFound: number;
}

export interface ClashEngineCallbacks {
  onProgress?: (progress: ClashProgress) => void;
  onBatchResults?: (batch: ClashResult[]) => void;
  isCancelled?: () => boolean;
}

export type ClashRunStatus = 'completed' | 'cancelled' | 'error';

export interface ClashRunSummary {
  testId: string;
  status: ClashRunStatus;
  totalPairsConsidered: number;
  candidatesCount: number;
  pairsProcessed: number;
  clashesCount: number;
  durationMs: number;
  results: ClashResult[];
  skippedMissingGeometryCount: number;
}

/**
 * Executes a full clash detection test across elements:
 * 1. Broad-phase Sweep-and-Prune filtering on bounding boxes
 * 2. Narrow-phase geometry test (Hard, Clearance, or Duplicates)
 * 3. Batch progress reporting and cooperative cancellation
 */
export async function runClashTest(
  testConfig: ClashTestConfig,
  elementMap: Map<string | number, NarrowphaseElement>,
  callbacks?: ClashEngineCallbacks,
  batchSize = 50,
): Promise<ClashRunSummary> {
  const t0 = performance.now();
  const ignoreSameElement = testConfig.ignoreSameElement ?? true;

  // 1. Gather Broad-phase input sets
  const setA: BoundingBoxItem[] = [];
  const setB: BoundingBoxItem[] = [];
  let skippedMissing = 0;

  for (const id of testConfig.selectionA) {
    const el = elementMap.get(id);
    if (!el || !el.geometry || !el.box || el.box.isEmpty()) {
      skippedMissing++;
      continue;
    }
    setA.push({ id: el.id, box: el.box });
  }

  for (const id of testConfig.selectionB) {
    const el = elementMap.get(id);
    if (!el || !el.geometry || !el.box || el.box.isEmpty()) {
      skippedMissing++;
      continue;
    }
    setB.push({ id: el.id, box: el.box });
  }

  const totalPairsConsidered = setA.length * setB.length;

  // 2. Broad-phase Sweep-and-Prune
  const candidates: CandidatePair[] = sweepAndPrune(setA, setB, {
    tolerance: testConfig.tolerance,
    ignoreSameElement,
  });

  const totalCandidates = candidates.length;
  const results: ClashResult[] = [];
  let currentBatch: ClashResult[] = [];
  let pairsProcessed = 0;
  let status: ClashRunStatus = 'completed';

  // Report initial progress
  callbacks?.onProgress?.({
    testId: testConfig.id,
    pairsChecked: 0,
    totalCandidatePairs: totalCandidates,
    percent: totalCandidates === 0 ? 100 : 0,
    clashesFound: 0,
  });

  // 3. Narrow-phase execution in batches
  for (let i = 0; i < totalCandidates; i++) {
    // Cooperative cancellation check between pairs / batches
    if (callbacks?.isCancelled?.()) {
      status = 'cancelled';
      break;
    }

    const pair = candidates[i]!;
    const elA = elementMap.get(pair.aId);
    const elB = elementMap.get(pair.bId);

    if (elA && elB) {
      const clash = checkNarrowphasePair(
        elA,
        elB,
        testConfig.type,
        testConfig.tolerance,
        testConfig.id,
      );

      if (clash) {
        results.push(clash);
        currentBatch.push(clash);
      }
    }

    pairsProcessed++;

    // Emit batch results and progress
    if (currentBatch.length >= batchSize || i === totalCandidates - 1) {
      if (currentBatch.length > 0) {
        callbacks?.onBatchResults?.([...currentBatch]);
        currentBatch = [];
      }

      const percent = totalCandidates > 0 ? Math.round(((i + 1) / totalCandidates) * 100) : 100;
      callbacks?.onProgress?.({
        testId: testConfig.id,
        pairsChecked: i + 1,
        totalCandidatePairs: totalCandidates,
        percent,
        clashesFound: results.length,
      });

      // Yield event loop momentarily for async cooperative cancellation if running on main thread
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  // Flush any remaining batch items upon early cancellation
  if (currentBatch.length > 0) {
    callbacks?.onBatchResults?.([...currentBatch]);
  }

  const durationMs = performance.now() - t0;

  return {
    testId: testConfig.id,
    status,
    totalPairsConsidered,
    candidatesCount: totalCandidates,
    pairsProcessed,
    clashesCount: results.length,
    durationMs,
    results,
    skippedMissingGeometryCount: skippedMissing,
  };
}


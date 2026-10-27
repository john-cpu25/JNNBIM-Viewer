import { describe, it, expect } from 'vitest';
import { mergeClashResults, type ClashRecord } from './clashResults';
import type { ClashResult } from './narrowphase';
import type { JnnElement } from '../domain/model';

describe('clashResults status lifecycle (New / Active / Resolved)', () => {
  const dummyElementA: Partial<JnnElement> = {
    id: 'el-100',
    globalId: 'guid-100',
    name: 'North Concrete Wall',
    category: 'IfcWall',
    storey: 'Level 1',
  };

  const dummyElementB: Partial<JnnElement> = {
    id: 'el-200',
    globalId: 'guid-200',
    name: 'Primary Steel Beam',
    category: 'IfcBeam',
    storey: 'Level 1',
  };

  const elementsMap = new Map<string, JnnElement>([
    ['el-100', dummyElementA as JnnElement],
    ['el-200', dummyElementB as JnnElement],
  ]);

  it('Run 1: newly detected clashes start with status "New"', () => {
    const rawRun1: ClashResult[] = [
      {
        clashId: 'clash_wall_beam',
        testId: 'test_1',
        aId: 'el-100',
        bId: 'el-200',
        aGuid: 'guid-100',
        bGuid: 'guid-200',
        type: 'Hard',
        distance: 0,
        point: [10, 20, 3],
        boxOverlap: { min: [0, 0, 0], max: [1, 1, 1] },
      },
      {
        clashId: 'clash_duct_pipe',
        testId: 'test_1',
        aId: 'el-300',
        bId: 'el-400',
        type: 'Clearance',
        distance: 0.02,
        point: [5, 12, 4],
        boxOverlap: { min: [0, 0, 0], max: [1, 1, 1] },
      },
    ];

    const recordsRun1 = mergeClashResults('test_1', [], rawRun1, {
      elementsMap,
      now: 1000,
    });

    expect(recordsRun1.length).toBe(2);
    expect(recordsRun1[0]!.clashId).toBe('clash_wall_beam');
    expect(recordsRun1[0]!.status).toBe('New');
    expect(recordsRun1[0]!.aName).toBe('North Concrete Wall');
    expect(recordsRun1[0]!.bName).toBe('Primary Steel Beam');
    expect(recordsRun1[0]!.aClass).toBe('IfcWall');
    expect(recordsRun1[0]!.aStorey).toBe('Level 1');
    expect(recordsRun1[0]!.firstFoundAt).toBe(1000);

    expect(recordsRun1[1]!.clashId).toBe('clash_duct_pipe');
    expect(recordsRun1[1]!.status).toBe('New');
  });

  it('Run 2: persistent clash becomes "Active", disappeared clash becomes "Resolved", new clash is "New"', () => {
    const recordsRun1: ClashRecord[] = [
      {
        clashId: 'c1_persistent',
        testId: 'test_1',
        name: 'Clash 1',
        status: 'New',
        type: 'Hard',
        distance: 0,
        aId: '10',
        bId: '20',
        point: [0, 0, 0],
        firstFoundAt: 1000,
        lastFoundAt: 1000,
      },
      {
        clashId: 'c2_fixed',
        testId: 'test_1',
        name: 'Clash 2',
        status: 'New',
        type: 'Hard',
        distance: 0,
        aId: '30',
        bId: '40',
        point: [1, 1, 1],
        firstFoundAt: 1000,
        lastFoundAt: 1000,
      },
    ];

    // In Run 2: c1 still exists, c2 is fixed (not in results), and c3 is brand new
    const rawRun2: ClashResult[] = [
      {
        clashId: 'c1_persistent',
        testId: 'test_1',
        aId: '10',
        bId: '20',
        type: 'Hard',
        distance: 0,
        point: [0, 0, 0],
        boxOverlap: { min: [0, 0, 0], max: [1, 1, 1] },
      },
      {
        clashId: 'c3_brand_new',
        testId: 'test_1',
        aId: '50',
        bId: '60',
        type: 'Clearance',
        distance: 0.03,
        point: [2, 3, 4],
        boxOverlap: { min: [0, 0, 0], max: [1, 1, 1] },
      },
    ];

    const recordsRun2 = mergeClashResults('test_1', recordsRun1, rawRun2, {
      now: 2000,
    });

    const c1 = recordsRun2.find((r) => r.clashId === 'c1_persistent')!;
    const c2 = recordsRun2.find((r) => r.clashId === 'c2_fixed')!;
    const c3 = recordsRun2.find((r) => r.clashId === 'c3_brand_new')!;

    expect(c1).toBeDefined();
    expect(c1.status).toBe('Active'); // Transitioned from New -> Active
    expect(c1.lastFoundAt).toBe(2000);
    expect(c1.firstFoundAt).toBe(1000); // Preserved

    expect(c2).toBeDefined();
    expect(c2.status).toBe('Resolved'); // Automatically resolved!

    expect(c3).toBeDefined();
    expect(c3.status).toBe('New'); // Brand new
    expect(c3.firstFoundAt).toBe(2000);
  });

  it('Run 3: preserves user-assigned metadata (Reviewed/Approved, comments, assignedTo)', () => {
    const recordsRun2: ClashRecord[] = [
      {
        clashId: 'c1',
        testId: 'test_1',
        name: 'Clash 1',
        status: 'Reviewed',
        type: 'Hard',
        distance: 0,
        aId: '10',
        bId: '20',
        point: [0, 0, 0],
        assignedTo: 'Engineer Nguyen',
        comments: 'Acceptable clearance variance due to insulation',
        firstFoundAt: 1000,
        lastFoundAt: 2000,
      },
    ];

    const rawRun3: ClashResult[] = [
      {
        clashId: 'c1',
        testId: 'test_1',
        aId: '10',
        bId: '20',
        type: 'Hard',
        distance: 0,
        point: [0, 0, 0],
        boxOverlap: { min: [0, 0, 0], max: [1, 1, 1] },
      },
    ];

    const recordsRun3 = mergeClashResults('test_1', recordsRun2, rawRun3, {
      now: 3000,
    });

    const c1 = recordsRun3[0]!;
    expect(c1.status).toBe('Reviewed');
    expect(c1.assignedTo).toBe('Engineer Nguyen');
    expect(c1.comments).toBe('Acceptable clearance variance due to insulation');
    expect(c1.lastFoundAt).toBe(3000);
  });
});

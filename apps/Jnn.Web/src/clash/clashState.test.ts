import { describe, it, expect } from 'vitest';
import {
  clashReducer,
  createDefaultClashTest,
  initialClashState,
  type ClashState,
} from './clashState';
import {
  computeModelsKey,
  exportTestsToJson,
  importTestsFromJson,
} from './clashStorage';
import type { ClashResult } from './narrowphase';

describe('clashState reducer and CRUD', () => {
  it('creates a default clash test with sensible defaults', () => {
    const test = createDefaultClashTest(0);
    expect(test.name).toBe('Test 1');
    expect(test.type).toBe('Hard');
    expect(test.tolerance).toBe(0);
    expect(test.status).toBe('idle');
    expect(test.results).toEqual([]);
    expect(test.ignoreSameElement).toBe(true);
  });

  it('adds a new test and sets it as active', () => {
    const s1 = clashReducer(initialClashState, { type: 'addTest' });
    expect(s1.tests.length).toBe(1);
    expect(s1.activeTestId).toBe(s1.tests[0]!.id);

    const s2 = clashReducer(s1, {
      type: 'addTest',
      test: { name: 'Beam vs Duct', tolerance: 0.05 },
    });
    expect(s2.tests.length).toBe(2);
    expect(s2.tests[1]!.name).toBe('Beam vs Duct');
    expect(s2.tests[1]!.tolerance).toBe(0.05);
    expect(s2.activeTestId).toBe(s2.tests[1]!.id);
  });

  it('updates an existing test', () => {
    const s1 = clashReducer(initialClashState, { type: 'addTest' });
    const id = s1.tests[0]!.id;

    const s2 = clashReducer(s1, {
      type: 'updateTest',
      id,
      updates: { name: 'Renamed Test', type: 'Clearance', tolerance: 0.1 },
    });
    expect(s2.tests[0]!.name).toBe('Renamed Test');
    expect(s2.tests[0]!.type).toBe('Clearance');
    expect(s2.tests[0]!.tolerance).toBe(0.1);
  });

  it('duplicates an existing test', () => {
    const s1 = clashReducer(initialClashState, {
      type: 'addTest',
      test: { name: 'Wall vs Slab', tolerance: 0.02 },
    });
    const id = s1.tests[0]!.id;

    const s2 = clashReducer(s1, { type: 'duplicateTest', id });
    expect(s2.tests.length).toBe(2);
    expect(s2.tests[1]!.name).toBe('Wall vs Slab (Copy)');
    expect(s2.tests[1]!.tolerance).toBe(0.02);
    expect(s2.tests[1]!.id).not.toBe(id);
    expect(s2.activeTestId).toBe(s2.tests[1]!.id);
  });

  it('deletes a test and adjusts activeTestId', () => {
    let state: ClashState = initialClashState;
    state = clashReducer(state, { type: 'addTest', test: { name: 'T1' } });
    state = clashReducer(state, { type: 'addTest', test: { name: 'T2' } });
    const id1 = state.tests[0]!.id;
    const id2 = state.tests[1]!.id;

    // Delete active test id2
    state = clashReducer(state, { type: 'deleteTest', id: id2 });
    expect(state.tests.length).toBe(1);
    expect(state.activeTestId).toBe(id1);

    // Delete remaining test
    state = clashReducer(state, { type: 'deleteTest', id: id1 });
    expect(state.tests.length).toBe(0);
    expect(state.activeTestId).toBeNull();
  });

  it('manages run lifecycle: setTestRunning, setTestProgress, setTestCompleted, setTestError', () => {
    let state = clashReducer(initialClashState, { type: 'addTest' });
    const id = state.tests[0]!.id;

    state = clashReducer(state, { type: 'setTestRunning', id });
    expect(state.tests[0]!.status).toBe('running');
    expect(state.tests[0]!.progressPercent).toBe(0);

    state = clashReducer(state, { type: 'setTestProgress', id, percent: 50 });
    expect(state.tests[0]!.progressPercent).toBe(50);

    const mockResults: ClashResult[] = [
      {
        clashId: 'c1',
        testId: 't1',
        aId: 'm1:10',
        bId: 'm2:20',
        aGuid: 'g1',
        bGuid: 'g2',
        type: 'Hard',
        distance: 0,
        point: [0, 0, 0],
        boxOverlap: { min: [0, 0, 0], max: [1, 1, 1] },
      },
    ];

    state = clashReducer(state, { type: 'setTestCompleted', id, results: mockResults });
    expect(state.tests[0]!.status).toBe('completed');
    expect(state.tests[0]!.progressPercent).toBe(100);
    expect(state.tests[0]!.clashesCount).toBe(1);
    expect(state.tests[0]!.results).toEqual(mockResults);
    expect(state.tests[0]!.lastRunTime).toBeDefined();

    // Error state
    state = clashReducer(state, { type: 'setTestError', id, error: 'Worker error' });
    expect(state.tests[0]!.status).toBe('error');
    expect(state.tests[0]!.error).toBe('Worker error');
  });

  it('loads tests from bulk array', () => {
    const t1 = createDefaultClashTest(0, { name: 'Loaded 1' });
    const t2 = createDefaultClashTest(1, { name: 'Loaded 2' });

    const state = clashReducer(initialClashState, { type: 'loadTests', tests: [t1, t2] });
    expect(state.tests.length).toBe(2);
    expect(state.activeTestId).toBe(t1.id);
  });

  it('selects a clash item', () => {
    const state = clashReducer(initialClashState, { type: 'selectClash', clashId: 'c123' });
    expect(state.selectedClashId).toBe('c123');
  });
});

describe('clashStorage helpers', () => {
  it('computes deterministic modelsKey', () => {
    expect(computeModelsKey([])).toBe('default_session');
    expect(computeModelsKey(['modelB.ifc', 'modelA.ifc'])).toBe('modelA.ifc::modelB.ifc');
    expect(computeModelsKey(['modelA.ifc', 'modelA.ifc'])).toBe('modelA.ifc');
  });

  it('exports and imports test config JSON accurately', () => {
    const tests = [
      createDefaultClashTest(0, { name: 'Exported 1', tolerance: 0.05 }),
      createDefaultClashTest(1, { name: 'Exported 2', type: 'Clearance' }),
    ];
    const json = exportTestsToJson(tests);
    expect(typeof json).toBe('string');

    const imported = importTestsFromJson(json);
    expect(imported.length).toBe(2);
    expect(imported[0]!.name).toBe('Exported 1');
    expect(imported[0]!.tolerance).toBe(0.05);
    expect(imported[1]!.name).toBe('Exported 2');
    expect(imported[1]!.type).toBe('Clearance');
  });

  it('throws on invalid json import', () => {
    expect(() => importTestsFromJson('invalid-json')).toThrow();
    expect(() => importTestsFromJson('{"not": "array"}')).toThrow();
  });
});

import type { ClashResult, ClashType } from './narrowphase';

export type ClashTestStatus = 'idle' | 'running' | 'completed' | 'error';

export interface ElementSelectionCriteria {
  modelId?: string;  // Empty means all models
  ifcClass?: string; // Empty means all classes
}

export interface ClashTestItem {
  id: string;
  name: string;
  type: ClashType;
  tolerance: number; // in meters
  selectionA: ElementSelectionCriteria;
  selectionB: ElementSelectionCriteria;
  ignoreSameModel?: boolean;
  ignoreSameElement?: boolean;
  status: ClashTestStatus;
  progressPercent?: number;
  clashesCount?: number;
  lastRunTime?: number;
  results?: ClashResult[];
  error?: string;
}

export interface ClashState {
  tests: ClashTestItem[];
  activeTestId: string | null;
  selectedClashId: string | null;
}

export const initialClashState: ClashState = {
  tests: [],
  activeTestId: null,
  selectedClashId: null,
};

export type ClashAction =
  | { type: 'addTest'; test?: Partial<ClashTestItem> }
  | { type: 'updateTest'; id: string; updates: Partial<ClashTestItem> }
  | { type: 'duplicateTest'; id: string }
  | { type: 'deleteTest'; id: string }
  | { type: 'setActiveTest'; id: string | null }
  | { type: 'setTestRunning'; id: string }
  | { type: 'setTestProgress'; id: string; percent: number }
  | { type: 'setTestCompleted'; id: string; results: ClashResult[] }
  | { type: 'setTestError'; id: string; error: string }
  | { type: 'loadTests'; tests: ClashTestItem[] }
  | { type: 'selectClash'; clashId: string | null };

export function createDefaultClashTest(existingCount = 0, partial?: Partial<ClashTestItem>): ClashTestItem {
  const id = `test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    name: partial?.name ?? `Test ${existingCount + 1}`,
    type: partial?.type ?? 'Hard',
    tolerance: partial?.tolerance ?? 0,
    selectionA: {
      modelId: partial?.selectionA?.modelId ?? '',
      ifcClass: partial?.selectionA?.ifcClass ?? '',
    },
    selectionB: {
      modelId: partial?.selectionB?.modelId ?? '',
      ifcClass: partial?.selectionB?.ifcClass ?? '',
    },
    ignoreSameModel: partial?.ignoreSameModel ?? false,
    ignoreSameElement: partial?.ignoreSameElement ?? true,
    status: 'idle',
    progressPercent: 0,
    clashesCount: 0,
    results: [],
    ...partial,
  };
}

export function clashReducer(state: ClashState, action: ClashAction): ClashState {
  switch (action.type) {
    case 'addTest': {
      const newTest = createDefaultClashTest(state.tests.length, action.test);
      return {
        ...state,
        tests: [...state.tests, newTest],
        activeTestId: newTest.id,
      };
    }

    case 'updateTest': {
      return {
        ...state,
        tests: state.tests.map((t) => (t.id === action.id ? { ...t, ...action.updates } : t)),
      };
    }

    case 'duplicateTest': {
      const target = state.tests.find((t) => t.id === action.id);
      if (!target) return state;

      const dupId = `test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const duplicated: ClashTestItem = {
        ...target,
        id: dupId,
        name: `${target.name} (Copy)`,
        status: 'idle',
        progressPercent: 0,
        results: [],
        clashesCount: 0,
        lastRunTime: undefined,
        error: undefined,
      };

      return {
        ...state,
        tests: [...state.tests, duplicated],
        activeTestId: dupId,
      };
    }

    case 'deleteTest': {
      const filtered = state.tests.filter((t) => t.id !== action.id);
      let nextActiveId = state.activeTestId;
      if (state.activeTestId === action.id) {
        nextActiveId = filtered.length > 0 ? filtered[0]!.id : null;
      }
      return {
        ...state,
        tests: filtered,
        activeTestId: nextActiveId,
        selectedClashId: state.activeTestId === action.id ? null : state.selectedClashId,
      };
    }

    case 'setActiveTest': {
      return {
        ...state,
        activeTestId: action.id,
        selectedClashId: null,
      };
    }

    case 'setTestRunning': {
      return {
        ...state,
        tests: state.tests.map((t) =>
          t.id === action.id ? { ...t, status: 'running', progressPercent: 0, error: undefined } : t,
        ),
      };
    }

    case 'setTestProgress': {
      return {
        ...state,
        tests: state.tests.map((t) => (t.id === action.id ? { ...t, progressPercent: action.percent } : t)),
      };
    }

    case 'setTestCompleted': {
      return {
        ...state,
        tests: state.tests.map((t) =>
          t.id === action.id
            ? {
                ...t,
                status: 'completed',
                progressPercent: 100,
                results: action.results,
                clashesCount: action.results.length,
                lastRunTime: Date.now(),
              }
            : t,
        ),
      };
    }

    case 'setTestError': {
      return {
        ...state,
        tests: state.tests.map((t) =>
          t.id === action.id ? { ...t, status: 'error', error: action.error } : t,
        ),
      };
    }

    case 'loadTests': {
      const firstId = action.tests.length > 0 ? action.tests[0]!.id : null;
      return {
        ...state,
        tests: action.tests,
        activeTestId: action.tests.some((t) => t.id === state.activeTestId) ? state.activeTestId : firstId,
      };
    }

    case 'selectClash': {
      return {
        ...state,
        selectedClashId: action.clashId,
      };
    }

    default:
      return state;
  }
}

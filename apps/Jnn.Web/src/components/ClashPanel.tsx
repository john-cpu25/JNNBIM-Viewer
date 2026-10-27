import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Play,
  Plus,
  Square,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import {
  clashReducer,
  createDefaultClashTest,
  initialClashState,
} from '../clash/clashState';
import {
  computeModelsKey,
  exportTestsToJson,
  importTestsFromJson,
  loadClashTests,
  saveClashTests,
} from '../clash/clashStorage';
import type { ClashType } from '../clash/narrowphase';
import { ClashWorkerClient } from '../clash/clashWorkerClient';
import type { SerializedElementPayload } from '../clash/clash.worker';
import type { ClashProgress } from '../clash/engine';
import { mergeClashResults } from '../clash/clashResults';
import { elementBounds, isEmpty } from '../domain/bounds';
import { ClashResultsTable } from './ClashResultsTable';
import { cn } from '../lib/cn';

function normalizeCategory(cat: string): string {
  let s = (cat || '').toLowerCase().trim();
  if (s.startsWith('ifc')) s = s.slice(3);
  if (s.endsWith('segment')) s = s.slice(0, -7);
  if (s.endsWith('s') && s.length > 3) s = s.slice(0, -1);
  return s;
}

function matchClassCriteria(elementCategory: string, criteriaClasses?: string): boolean {
  if (!criteriaClasses || !criteriaClasses.trim()) return true;
  const targets = criteriaClasses.split(',').map(normalizeCategory).filter(Boolean);
  const normCat = normalizeCategory(elementCategory);
  return targets.some((t) => normCat.includes(t) || t.includes(normCat));
}

const PRESET_TEMPLATES: Array<{
  name: string;
  type: ClashType;
  tolerance: number;
  selectionA: { ifcClass: string };
  selectionB: { ifcClass: string };
  ignoreSameModel: boolean;
}> = [
  {
    name: 'Kết cấu × Kiến trúc (Hard)',
    type: 'Hard',
    tolerance: 0,
    selectionA: { ifcClass: 'IfcBeam,IfcColumn,IfcSlab' },
    selectionB: { ifcClass: 'IfcWall,IfcDoor,IfcWindow' },
    ignoreSameModel: false,
  },
  {
    name: 'MEP × Kết cấu (Hard, 0)',
    type: 'Hard',
    tolerance: 0,
    selectionA: { ifcClass: 'IfcPipeSegment,IfcDuctSegment' },
    selectionB: { ifcClass: 'IfcBeam,IfcColumn,IfcSlab,IfcWall' },
    ignoreSameModel: false,
  },
  {
    name: 'MEP × MEP (Clearance 50mm)',
    type: 'Clearance',
    tolerance: 0.05,
    selectionA: { ifcClass: 'IfcPipeSegment' },
    selectionB: { ifcClass: 'IfcDuctSegment' },
    ignoreSameModel: true,
  },
];

export function ClashPanel() {
  const { state, viewer } = useApp();
  const [clashState, dispatch] = useReducer(clashReducer, initialClashState);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'config' | 'results'>('config');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerClientRef = useRef<ClashWorkerClient | null>(null);

  // Compute key representing currently active models
  const modelsKey = useMemo(() => {
    const keys = state.models.map((m) => m.fileName || m.name || m.modelId);
    return computeModelsKey(keys);
  }, [state.models]);

  // Load saved tests from IndexedDB on model change
  useEffect(() => {
    let active = true;
    loadClashTests(modelsKey)
      .then((saved) => {
        if (!active) return;
        if (saved && saved.length > 0) {
          dispatch({ type: 'loadTests', tests: saved });
        } else {
          // Initialize with 1 default test if empty
          const defaultTest = createDefaultClashTest(0, {
            name: 'Kiến trúc × Kết cấu (Hard)',
            selectionA: { ifcClass: 'IfcWall' },
            selectionB: { ifcClass: 'IfcBeam,IfcColumn' },
          });
          dispatch({ type: 'loadTests', tests: [defaultTest] });
        }
      })
      .catch((err) => {
        console.warn('[ClashPanel] Failed to load saved tests:', err);
      });

    return () => {
      active = false;
    };
  }, [modelsKey]);

  // Save tests whenever they change
  useEffect(() => {
    if (clashState.tests.length > 0) {
      saveClashTests(modelsKey, clashState.tests).catch((err) => {
        console.warn('[ClashPanel] Auto-save tests error:', err);
      });
    }
  }, [clashState.tests, modelsKey]);

  // Get active test
  const activeTest = useMemo(() => {
    return clashState.tests.find((t) => t.id === clashState.activeTestId) || clashState.tests[0] || null;
  }, [clashState.tests, clashState.activeTestId]);

  // Count elements matching Selection A and Selection B
  const elementCounts = useMemo(() => {
    if (!activeTest) return { countA: 0, countB: 0 };

    const countMatches = (criteria: { modelId?: string; ifcClass?: string }) => {
      return state.model.elements.filter((el) => {
        if (criteria.modelId && el.modelId && el.modelId !== criteria.modelId) {
          return false;
        }
        return matchClassCriteria(el.category, criteria.ifcClass);
      }).length;
    };

    return {
      countA: countMatches(activeTest.selectionA),
      countB: countMatches(activeTest.selectionB),
    };
  }, [activeTest, state.model.elements]);

  // Validate tolerance
  useEffect(() => {
    if (!activeTest) {
      setValidationError(null);
      return;
    }
    if (isNaN(activeTest.tolerance) || activeTest.tolerance < 0) {
      setValidationError('Dung sai (tolerance) không được là số âm hoặc rỗng');
    } else if (activeTest.type === 'Clearance' && activeTest.tolerance <= 0) {
      setValidationError('Kiểm tra Clearance yêu cầu dung sai lớn hơn 0');
    } else {
      setValidationError(null);
    }
  }, [activeTest?.tolerance, activeTest?.type]);

  // Add new test
  const onAddTest = () => {
    dispatch({ type: 'addTest' });
  };

  // Duplicate test
  const onDuplicateTest = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'duplicateTest', id });
  };

  // Delete test
  const onDeleteTest = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'deleteTest', id });
  };

  // Apply preset
  const onApplyPreset = (preset: (typeof PRESET_TEMPLATES)[0]) => {
    if (!activeTest) return;
    dispatch({
      type: 'updateTest',
      id: activeTest.id,
      updates: {
        name: preset.name,
        type: preset.type,
        tolerance: preset.tolerance,
        selectionA: { ...activeTest.selectionA, ifcClass: preset.selectionA.ifcClass },
        selectionB: { ...activeTest.selectionB, ifcClass: preset.selectionB.ifcClass },
        ignoreSameModel: preset.ignoreSameModel,
      },
    });
  };

  // Export JSON
  const onExportJson = () => {
    const json = exportTestsToJson(clashState.tests);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clash-tests-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const onImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const imported = importTestsFromJson(text);
        if (imported.length > 0) {
          dispatch({ type: 'loadTests', tests: imported });
        }
      } catch (err) {
        alert('File JSON cấu hình không hợp lệ: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Run test
  const onRunTest = async () => {
    if (!activeTest || validationError) return;

    dispatch({ type: 'setTestRunning', id: activeTest.id });

    try {
      const client = new ClashWorkerClient();
      workerClientRef.current = client;

      // Extract geometry from viewer if available or create fallback from element models
      let serializedElements: SerializedElementPayload[] = [];
      if (viewer && 'extractElementGeometries' in viewer) {
        try {
          serializedElements = await (viewer as any).extractElementGeometries();
        } catch {
          serializedElements = [];
        }
      }

      // If no meshes extracted from viewer, produce elements from state.model with real AABBs
      if (serializedElements.length === 0) {
        serializedElements = state.model.elements.map((el) => {
          const eb = elementBounds(el);
          const min = isEmpty(eb) ? [-0.5, -0.5, 0] : eb.min;
          const max = isEmpty(eb) ? [0.5, 0.5, 0.5] : eb.max;
          const x0 = min[0] ?? -0.5;
          const y0 = min[1] ?? -0.5;
          const z0 = min[2] ?? 0;
          const x1 = max[0] ?? 0.5;
          const y1 = max[1] ?? 0.5;
          const z1 = max[2] ?? 0.5;
          const pos = new Float32Array([
            x0, y0, z0,  x1, y0, z0,  x1, y1, z0,  x0, y1, z0, // 0..3 bottom
            x0, y0, z1,  x1, y0, z1,  x1, y1, z1,  x0, y1, z1, // 4..7 top
          ]);
          const ind = new Uint32Array([
            0, 1, 2,  0, 2, 3, // bottom
            4, 6, 5,  4, 7, 6, // top
            0, 4, 1,  1, 4, 5, // front
            1, 5, 2,  2, 5, 6, // right
            2, 6, 3,  3, 6, 7, // back
            3, 7, 0,  0, 7, 4, // left
          ]);
          return {
            id: el.id,
            guid: el.globalId || el.id,
            ifcClass: el.category,
            positions: pos.buffer.slice(0) as ArrayBuffer,
            indices: ind.buffer.slice(0) as ArrayBuffer,
            box: {
              min: [x0, y0, z0] as [number, number, number],
              max: [x1, y1, z1] as [number, number, number],
            },
          };
        });
      }

      // Load elements into worker
      await client.loadElements(serializedElements);

      // Filter IDs into group A and group B based on criteria
      const matchCriteria = (
        el: (typeof state.model.elements)[0],
        criteria: { modelId?: string; ifcClass?: string },
      ) => {
        if (criteria.modelId && el.modelId && el.modelId !== criteria.modelId) return false;
        return matchClassCriteria(el.category, criteria.ifcClass);
      };

      const idsA = state.model.elements.filter((e) => matchCriteria(e, activeTest.selectionA)).map((e) => e.id);
      const idsB = state.model.elements.filter((e) => matchCriteria(e, activeTest.selectionB)).map((e) => e.id);

      const summary = await client.runTest(
        {
          id: activeTest.id,
          name: activeTest.name,
          type: activeTest.type,
          tolerance: activeTest.tolerance,
          selectionA: idsA,
          selectionB: idsB,
          ignoreSameModel: activeTest.ignoreSameModel,
          ignoreSameElement: activeTest.ignoreSameElement,
        },
        {
          onProgress: (prog: ClashProgress) => {
            dispatch({ type: 'setTestProgress', id: activeTest.id, percent: prog.percent });
          },
        },
      );

      if (summary.status === 'completed') {
        const mergedRecords = mergeClashResults(
          activeTest.id,
          activeTest.records ?? [],
          summary.results,
          { elementsMap: state.byId },
        );
        dispatch({
          type: 'setTestCompleted',
          id: activeTest.id,
          results: summary.results,
          records: mergedRecords,
        });
        setSubTab('results');
      } else if (summary.status === 'cancelled') {
        dispatch({ type: 'setTestError', id: activeTest.id, error: 'Đã hủy kiểm tra' });
      } else {
        dispatch({ type: 'setTestError', id: activeTest.id, error: 'Kiểm tra thất bại' });
      }
    } catch (err) {
      dispatch({ type: 'setTestError', id: activeTest.id, error: (err as Error).message });
    } finally {
      workerClientRef.current?.terminate();
      workerClientRef.current = null;
    }
  };

  // Cancel running test
  const onCancelTest = () => {
    if (activeTest && activeTest.status === 'running') {
      workerClientRef.current?.cancel();
      workerClientRef.current?.terminate();
      workerClientRef.current = null;
      dispatch({ type: 'setTestError', id: activeTest.id, error: 'Đã hủy kiểm tra' });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-surface" data-testid="clash-panel">
      {/* Top action toolbar */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Zap size={14} className="text-accent" />
          <span className="text-xs font-semibold tracking-wide text-ink">Clash Detective</span>
          <span className="rounded bg-surface-3 px-1.5 py-0.2 text-[10.5px] font-medium text-muted">
            {clashState.tests.length} test
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAddTest}
            title="Thêm bài kiểm tra va chạm mới"
            data-testid="add-test-btn"
            className="flex items-center gap-1 rounded border border-line bg-surface-2 px-2 py-1 text-[11px] font-medium text-ink hover:border-accent hover:text-accent transition-colors"
          >
            <Plus size={12} />
            <span>Thêm</span>
          </button>
          <button
            type="button"
            onClick={onExportJson}
            title="Xuất danh sách test ra JSON"
            data-testid="export-tests-btn"
            className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink transition-colors"
          >
            <Download size={13} />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Nhập danh sách test từ JSON"
            data-testid="import-tests-btn"
            className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink transition-colors"
          >
            <Upload size={13} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={onImportJson}
            data-testid="import-json-input"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scroll-thin">
        {/* Test List */}
        <div className="border-b border-line p-2">
          <div className="mb-1 text-[11px] font-semibold text-muted uppercase tracking-wider px-1">
            Danh sách bài kiểm tra
          </div>
          <div className="space-y-1" data-testid="test-list">
            {clashState.tests.map((t) => {
              const isActive = t.id === activeTest?.id;
              return (
                <div
                  key={t.id}
                  onClick={() => dispatch({ type: 'setActiveTest', id: t.id })}
                  data-testid={`test-item-${t.id}`}
                  className={cn(
                    'group flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition-colors',
                    isActive
                      ? 'bg-accent/15 border border-accent/40 font-medium text-ink'
                      : 'bg-surface-2/60 border border-transparent hover:bg-surface-2 hover:text-ink text-muted',
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate">{t.name}</span>
                    {/* Status badge */}
                    {t.status === 'idle' && (
                      <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-muted">
                        Chưa chạy
                      </span>
                    )}
                    {t.status === 'running' && (
                      <span className="flex items-center gap-1 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent animate-pulse font-medium">
                        <Clock size={10} className="animate-spin" />
                        {t.progressPercent ?? 0}%
                      </span>
                    )}
                    {t.status === 'completed' && (
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium',
                          (t.clashesCount ?? 0) > 0
                            ? 'bg-amber-500/20 text-amber-500'
                            : 'bg-emerald-500/20 text-emerald-500',
                        )}
                      >
                        {(t.clashesCount ?? 0) > 0 ? `${t.clashesCount} va chạm` : '0 va chạm'}
                      </span>
                    )}
                    {t.status === 'error' && (
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-500 font-medium">
                        Lỗi
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => onDuplicateTest(t.id, e)}
                      title="Nhân bản bài test này"
                      data-testid={`duplicate-test-${t.id}`}
                      className="p-1 rounded text-muted hover:text-ink hover:bg-surface-3"
                    >
                      <Copy size={11} />
                    </button>
                    {clashState.tests.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => onDeleteTest(t.id, e)}
                        title="Xóa bài test này"
                        data-testid={`delete-test-${t.id}`}
                        className="p-1 rounded text-muted hover:text-red-500 hover:bg-surface-3"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Test Sub-tabs Switcher */}
        {activeTest && (
          <div className="flex items-center border-b border-line bg-surface-2 px-3 pt-1">
            <button
              type="button"
              onClick={() => setSubTab('config')}
              data-testid="subtab-config-btn"
              className={cn(
                'border-b-2 px-3 py-1.5 text-xs font-medium transition-colors',
                subTab === 'config'
                  ? 'border-accent text-accent font-semibold'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              Cấu hình
            </button>
            <button
              type="button"
              onClick={() => setSubTab('results')}
              data-testid="subtab-results-btn"
              className={cn(
                'flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-medium transition-colors',
                subTab === 'results'
                  ? 'border-accent text-accent font-semibold'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              <span>Kết quả</span>
              {(activeTest.records?.length ?? activeTest.clashesCount ?? 0) > 0 && (
                <span className="rounded bg-accent/20 px-1.5 py-0.2 text-[10px] font-semibold text-accent tabular">
                  {activeTest.records?.length ?? activeTest.clashesCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Results tab view */}
        {activeTest && subTab === 'results' && (
          <ClashResultsTable
            testId={activeTest.id}
            records={activeTest.records ?? []}
            selectedClashId={clashState.selectedClashId}
            onSelectClash={(clashId) => dispatch({ type: 'selectClash', clashId })}
            onUpdateRecord={(clashId, updates) =>
              dispatch({ type: 'updateClashRecord', testId: activeTest.id, clashId, updates })
            }
          />
        )}

        {/* Active Test Configuration Form */}
        {activeTest && subTab === 'config' && (
          <div className="space-y-4 p-3" data-testid="test-config-form">
            {/* Presets row */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                Mẫu nhanh (Presets)
              </span>
              <div className="flex flex-wrap gap-1">
                {PRESET_TEMPLATES.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onApplyPreset(p)}
                    data-testid={`preset-btn-${idx}`}
                    className="rounded bg-surface-2 border border-line px-2 py-0.5 text-[11px] text-muted hover:border-accent hover:text-ink transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Test name input */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink">Tên bài kiểm tra</label>
              <input
                type="text"
                value={activeTest.name}
                data-testid="test-name-input"
                onChange={(e) =>
                  dispatch({
                    type: 'updateTest',
                    id: activeTest.id,
                    updates: { name: e.target.value },
                  })
                }
                className="w-full rounded border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
              />
            </div>

            {/* Clash type & tolerance */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-ink">Loại va chạm</label>
                <select
                  value={activeTest.type}
                  data-testid="clash-type-select"
                  onChange={(e) =>
                    dispatch({
                      type: 'updateTest',
                      id: activeTest.id,
                      updates: { type: e.target.value as ClashType },
                    })
                  }
                  className="w-full rounded border border-line bg-surface-2 px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                >
                  <option value="Hard">Hard (Va chạm vật lý)</option>
                  <option value="Clearance">Clearance (Khoảng cách an toàn)</option>
                  <option value="Duplicates">Duplicates (Trùng lặp)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-ink">Dung sai (m)</label>
                <input
                  type="number"
                  step="0.001"
                  value={isNaN(activeTest.tolerance) ? '' : activeTest.tolerance}
                  data-testid="tolerance-input"
                  onChange={(e) => {
                    const parsed = e.target.value === '' ? NaN : parseFloat(e.target.value);
                    dispatch({
                      type: 'updateTest',
                      id: activeTest.id,
                      updates: { tolerance: parsed },
                    });
                  }}
                  className="w-full rounded border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* Validation error notice */}
            {validationError && (
              <div
                className="flex items-center gap-1.5 rounded bg-red-500/10 border border-red-500/30 p-2 text-xs text-red-500"
                data-testid="validation-error"
              >
                <AlertCircle size={14} className="shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Selection A */}
            <div className="rounded-md border border-line p-2.5 space-y-2 bg-surface-2/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Tập kiểm tra A
                </span>
                <span className="rounded bg-surface-3 px-1.5 py-0.2 text-[10px] text-muted font-medium tabular">
                  {elementCounts.countA} phần tử
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted">Mô hình:</label>
                <select
                  value={activeTest.selectionA.modelId || ''}
                  data-testid="selection-a-model"
                  onChange={(e) =>
                    dispatch({
                      type: 'updateTest',
                      id: activeTest.id,
                      updates: {
                        selectionA: { ...activeTest.selectionA, modelId: e.target.value },
                      },
                    })
                  }
                  className="w-full rounded border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                >
                  <option value="">Tất cả mô hình ({state.models.length})</option>
                  {state.models.map((m) => (
                    <option key={m.modelId} value={m.modelId}>
                      {m.fileName || m.name || m.modelId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted">IFC Class (cách nhau dấu phẩy):</label>
                <input
                  type="text"
                  placeholder="ví dụ: IfcWall, IfcBeam hoặc để trống = Tất cả"
                  value={activeTest.selectionA.ifcClass || ''}
                  data-testid="selection-a-class"
                  onChange={(e) =>
                    dispatch({
                      type: 'updateTest',
                      id: activeTest.id,
                      updates: {
                        selectionA: { ...activeTest.selectionA, ifcClass: e.target.value },
                      },
                    })
                  }
                  className="w-full rounded border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* Selection B */}
            <div className="rounded-md border border-line p-2.5 space-y-2 bg-surface-2/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Tập kiểm tra B
                </span>
                <span className="rounded bg-surface-3 px-1.5 py-0.2 text-[10px] text-muted font-medium tabular">
                  {elementCounts.countB} phần tử
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted">Mô hình:</label>
                <select
                  value={activeTest.selectionB.modelId || ''}
                  data-testid="selection-b-model"
                  onChange={(e) =>
                    dispatch({
                      type: 'updateTest',
                      id: activeTest.id,
                      updates: {
                        selectionB: { ...activeTest.selectionB, modelId: e.target.value },
                      },
                    })
                  }
                  className="w-full rounded border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                >
                  <option value="">Tất cả mô hình ({state.models.length})</option>
                  {state.models.map((m) => (
                    <option key={m.modelId} value={m.modelId}>
                      {m.fileName || m.name || m.modelId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted">IFC Class (cách nhau dấu phẩy):</label>
                <input
                  type="text"
                  placeholder="ví dụ: IfcBeam, IfcColumn hoặc để trống = Tất cả"
                  value={activeTest.selectionB.ifcClass || ''}
                  data-testid="selection-b-class"
                  onChange={(e) =>
                    dispatch({
                      type: 'updateTest',
                      id: activeTest.id,
                      updates: {
                        selectionB: { ...activeTest.selectionB, ifcClass: e.target.value },
                      },
                    })
                  }
                  className="w-full rounded border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* Ignore same model checkbox */}
            <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={activeTest.ignoreSameModel ?? false}
                data-testid="ignore-same-model-checkbox"
                onChange={(e) =>
                  dispatch({
                    type: 'updateTest',
                    id: activeTest.id,
                    updates: { ignoreSameModel: e.target.checked },
                  })
                }
                className="rounded border-line text-accent"
              />
              <span>Bỏ qua các cặp phần tử trong cùng một mô hình</span>
            </label>

            {/* Run / Cancel buttons & progress */}
            <div className="pt-2 space-y-2">
              {activeTest.status === 'running' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-ink">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock size={13} className="animate-spin text-accent" />
                      Đang kiểm tra... ({activeTest.progressPercent ?? 0}%)
                    </span>
                    <button
                      type="button"
                      onClick={onCancelTest}
                      data-testid="cancel-test-btn"
                      className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-500 hover:bg-red-500/30"
                    >
                      <Square size={11} />
                      <span>Hủy</span>
                    </button>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded bg-surface-3">
                    <div
                      className="h-full bg-accent transition-all duration-200"
                      style={{ width: `${activeTest.progressPercent ?? 0}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={Boolean(validationError)}
                  onClick={onRunTest}
                  data-testid="run-test-btn"
                  className={cn(
                    'w-full flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold text-white transition-colors shadow-sm',
                    Boolean(validationError)
                      ? 'bg-muted cursor-not-allowed opacity-60'
                      : 'bg-accent hover:bg-accent/90 cursor-pointer',
                  )}
                >
                  <Play size={13} className="fill-current" />
                  <span>Chạy kiểm tra va chạm</span>
                </button>
              )}

              {/* Status summary banner */}
              {activeTest.status === 'completed' && (
                <div
                  className={cn(
                    'flex items-center justify-between rounded border p-2.5 text-xs',
                    (activeTest.clashesCount ?? 0) > 0
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
                  )}
                  data-testid="test-completed-banner"
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 size={14} />
                    <span>Hoàn tất kiểm tra</span>
                  </div>
                  <span className="font-semibold">
                    {activeTest.clashesCount ?? 0} va chạm được phát hiện
                  </span>
                </div>
              )}

              {activeTest.status === 'error' && (
                <div
                  className="flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-500"
                  data-testid="test-error-banner"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span>Lỗi: {activeTest.error}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

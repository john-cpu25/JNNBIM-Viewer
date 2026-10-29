import { useEffect, useRef, useState } from 'react';
import { FolderOpen, HelpCircle, Loader2, UploadCloud } from 'lucide-react';
import type { JnnModel } from '../domain/model';
import { ThreeViewerAdapter } from '../viewer/ThreeViewerAdapter';
import { ThatOpenViewerAdapter } from '../viewer/ThatOpenViewerAdapter';
import type { AdapterResult, Vec3, ViewerAdapter } from '../viewer/ViewerAdapter';
import { planeFromHit } from '../viewer/sectionMath';
import { useApp } from '../state/AppContext';
import { Toolbar } from './Toolbar';
import { ViewCube } from './ViewCube';
import { SectionPanel } from './SectionPanel';
import { loadIfcFile } from '../lib/ifcLoaderHelper';
import { cn } from '../lib/cn';

declare global {
  interface Window {
    /** Test/debug hook — only installed in dev builds or with `?debug=1`. */
    __jnn?: { viewer: ViewerAdapter; getState: () => unknown };
  }
}

const debugEnabled = () => import.meta.env.DEV || new URLSearchParams(location.search).has('debug');

export const isSampleMode = () => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('sample') === '1' || import.meta.env.MODE === 'test';
};

export function Viewport({ model, onViewer, compact }: { model: JnnModel; onViewer: (v: ViewerAdapter | null) => void; compact: boolean }) {
  const { state, dispatch, viewer } = useApp();
  const hostRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [convertStatus, setConvertStatus] = useState<string>('');
  const [showNavHelp, setShowNavHelp] = useState(false);

  const sample = isSampleMode();

  // Create / dispose the adapter with the component.
  useEffect(() => {
    const host = hostRef.current!;
    let adapter: ViewerAdapter;
    let cancelled = false;

    try {
      if (sample) {
        adapter = new ThreeViewerAdapter();
      } else {
        adapter = new ThatOpenViewerAdapter();
      }
      adapter.mount(host);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : String(e));
      return;
    }

    const offPick = adapter.on('pick', ({ result, additive }) => {
      if (stateRef.current.sectionPickMode) {
        if (result) {
          const camRes = adapter.getCamera();
          const cam = camRes.ok ? camRes.value : null;
          const viewDir: Vec3 = cam
            ? [cam.target[0] - cam.position[0], cam.target[1] - cam.position[1], cam.target[2] - cam.position[2]]
            : [0, 0, -1];
          const planeSpec = planeFromHit(result.point, result.normal ?? null, viewDir);
          dispatch({
            type: 'setSection',
            section: { kind: 'plane', ...planeSpec },
          });
        }
        dispatch({ type: 'setSectionPickMode', on: false });
        return;
      }
      if (!result) {
        if (!additive) dispatch({ type: 'clearSelection' });
        return;
      }
      dispatch({ type: 'select', ids: [result.elementId], mode: additive ? 'toggle' : 'replace', reveal: true });
    });
    const offHover = adapter.on('hover', ({ elementId }) => dispatch({ type: 'hover', id: elementId }));

    if (sample) {
      adapter.loadModel(model).then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setStatus('ready');
          onViewer(adapter);
          if (debugEnabled()) window.__jnn = { viewer: adapter, getState: () => stateRef.current };
        } else {
          setStatus('error');
          setError(r.message);
        }
      });
    } else {
      setStatus('ready');
      onViewer(adapter);
      if (debugEnabled()) window.__jnn = { viewer: adapter, getState: () => stateRef.current };
    }

    return () => {
      cancelled = true;
      offPick();
      offHover();
      onViewer(null);
      adapter.dispose();
      if (window.__jnn?.viewer === adapter) delete window.__jnn;
    };
  }, [sample, dispatch, onViewer]);

  // In sample mode, reload if model changes without remounting the adapter
  useEffect(() => {
    if (sample && viewer && model.modelId !== 'empty') {
      viewer.loadModel(model);
    }
  }, [sample, viewer, model]);

  // State → viewer synchronisation. Each effect reports adapter failures.
  const report = (r: AdapterResult | undefined) => {
    if (r && !r.ok && r.code !== 'unsupported') {
      dispatch({ type: 'notify', tone: 'warning', text: r.message ?? 'Viewer operation failed.' });
    }
  };
  useEffect(() => report(viewer?.select(state.selection)), [viewer, state.selection]);
  useEffect(() => {
    if (!viewer) return;
    report(viewer.setHidden([...state.visibility.hidden]));
    report(viewer.isolate([...state.visibility.isolated]));
  }, [viewer, state.visibility]);
  useEffect(() => report(viewer?.setSection(state.section)), [viewer, state.section]);
  useEffect(() => report(viewer?.setSectionFrameVisible?.(state.sectionFrameVisible)), [viewer, state.sectionFrameVisible]);
  useEffect(() => {
    if (!viewer) return;
    return viewer.on('sectionEdit', (ev) => {
      if (ev.phase === 'end') {
        dispatch({ type: 'setSection', section: ev.spec });
      }
    });
  }, [viewer, dispatch]);
  useEffect(() => report(viewer?.setXray(state.xray)), [viewer, state.xray]);
  useEffect(() => report(viewer?.setGridVisible?.(state.gridVisible)), [viewer, state.gridVisible]);
  useEffect(() => report(viewer?.setProjection(state.projection)), [viewer, state.projection]);
  useEffect(() => {
    viewer?.setNavigationSettings?.(state.navigation);
  }, [viewer, state.navigation]);
  useEffect(() => {
    if (!viewer) return;
    return viewer.on('navHint', (hint) => {
      if (hint.kind === 'holdShiftToOrbit') {
        dispatch({
          type: 'notify',
          tone: 'info',
          text: 'Giữ Shift + kéo chuột trái (hoặc chuột giữa) để xoay mô hình',
        });
      }
    });
  }, [viewer, dispatch]);
  useEffect(() => viewer?.setTheme(state.theme), [viewer, state.theme]);
  useEffect(() => {
    if (state.sectionPickMode) {
      dispatch({
        type: 'notify',
        tone: 'info',
        text: 'Click vào bề mặt cấu kiện để đặt mặt phẳng cắt (Esc để hủy)',
      });
      if (hostRef.current) {
        hostRef.current.style.cursor = 'crosshair';
      }
    } else if (hostRef.current) {
      hostRef.current.style.cursor = '';
    }
  }, [state.sectionPickMode, dispatch]);

  // Drag and drop handler
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setIsConverting(true);
      setConvertStatus('Đang nạp file kéo thả...');
      await loadIfcFile(file, viewer, dispatch, {
        onProgress: (pct, msg) => setConvertStatus(`${msg || 'Đang xử lý'} (${pct.toFixed(0)}%)`),
      });
      setIsConverting(false);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsConverting(true);
      setConvertStatus('Đang đọc file IFC...');
      await loadIfcFile(file, viewer, dispatch, {
        onProgress: (pct, msg) => setConvertStatus(`${msg || 'Đang xử lý'} (${pct.toFixed(0)}%)`),
      });
      setIsConverting(false);
      e.target.value = '';
    }
  };

  const hovered = state.hovered ? state.byId.get(state.hovered) : null;
  const showEmptyState = !sample && state.model.modelId === 'empty' && !isConverting;

  return (
    <div
      className={cn('absolute inset-0 overflow-hidden', isDragging && 'ring-2 ring-inset ring-accent')}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifc"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div ref={hostRef} className="absolute inset-0" data-testid="viewer-host" data-status={status} />

      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center text-muted">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="animate-spin" size={16} /> Loading model…
          </div>
        </div>
      )}

      {isConverting && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-surface/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface p-6 shadow-float">
            <Loader2 className="animate-spin text-accent" size={28} />
            <div className="text-sm font-medium text-ink">{convertStatus || 'Đang chuyển đổi mô hình sang Fragments...'}</div>
            <div className="text-xs text-muted">Web Worker & WebAssembly (offline)</div>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="max-w-sm rounded-lg border border-line bg-surface p-4 shadow-float">
            <div className="mb-1 font-semibold">The 3D viewer could not start</div>
            <div className="text-muted">{error}</div>
            <div className="mt-2 text-xs text-faint">WebGL 2 is required. Check GPU drivers or browser hardware acceleration.</div>
          </div>
        </div>
      )}

      {status === 'ready' && (
        <>
          <ViewCube />
          {state.section && <SectionPanel compact={compact} />}
          <Toolbar compact={compact} />

          {/* Mouse navigation help popover */}
          <div className="absolute right-3 bottom-3 z-20">
            {showNavHelp && (
              <div
                className="mb-2 w-72 rounded-lg border border-line bg-surface/95 p-3 text-xs shadow-float backdrop-blur"
                data-testid="nav-help-popover"
              >
                <div className="mb-2 flex items-center justify-between border-b border-line pb-1.5 font-semibold text-ink">
                  <span>Thao tác chuột</span>
                  <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent font-medium">
                    {state.navigation.preset === 'revit' ? 'Kiểu Revit' : 'Cổ điển'}
                  </span>
                </div>
                <div className="space-y-1.5 text-muted text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-ink font-medium">Xoay 3D:</span>
                    <span>
                      {state.navigation.preset === 'revit'
                        ? 'Shift + Kéo trái / giữa'
                        : 'Kéo chuột trái'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink font-medium">Di chuyển (Pan):</span>
                    <span>Kéo chuột giữa / phải</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink font-medium">Thu phóng (Zoom):</span>
                    <span>Lăn bánh xe chuột</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink font-medium">Vừa khung nhìn:</span>
                    <span>Click đúp chuột giữa (hoặc phím F)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink font-medium">Chọn thêm:</span>
                    <span>Shift / Ctrl + Click trái</span>
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-line flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNavHelp(false);
                      dispatch({ type: 'setSettingsOpen', open: true });
                    }}
                    className="rounded bg-surface-2 px-2 py-1 text-[11px] font-medium text-ink transition hover:bg-line"
                  >
                    Đổi sơ đồ chuột
                  </button>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowNavHelp(!showNavHelp)}
              aria-label="Trợ giúp điều hướng chuột"
              className={cn(
                'grid h-7 w-7 place-items-center rounded-full border border-line bg-surface/90 text-muted shadow-sm transition hover:bg-surface hover:text-ink',
                showNavHelp && 'bg-accent text-accent-contrast border-transparent',
              )}
            >
              <HelpCircle size={15} />
            </button>
          </div>
          {hovered && !compact && (
            <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-md bg-surface/90 px-2.5 py-1 text-xs text-muted shadow-float backdrop-blur">
              <span className="text-ink">{hovered.category}</span> · {hovered.name}
            </div>
          )}

          {showEmptyState && (
            <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center p-4">
              <div className="flex max-w-md flex-col items-center rounded-2xl border border-line bg-surface/90 p-8 text-center shadow-float backdrop-blur-md">
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent">
                  <UploadCloud size={28} />
                </div>
                <h2 className="mb-1.5 text-base font-semibold text-ink">Mở file IFC để bắt đầu</h2>
                <p className="mb-6 text-xs leading-relaxed text-muted">
                  Kéo và thả file IFC vào khung nhìn 3D này, hoặc chọn từ máy tính để phân tích và xem mô hình.
                </p>

                <div className="flex w-full flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-xs font-semibold text-accent-contrast shadow-sm transition hover:bg-accent-hover active:scale-[0.99]"
                  >
                    <FolderOpen size={15} />
                    <span>Chọn file IFC từ máy</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

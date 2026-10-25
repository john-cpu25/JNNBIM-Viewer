import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { JnnModel } from '../domain/model';
import { ThreeViewerAdapter } from '../viewer/ThreeViewerAdapter';
import type { ViewerAdapter } from '../viewer/ViewerAdapter';
import { useApp } from '../state/AppContext';
import { Toolbar } from './Toolbar';
import { ViewPresets } from './ViewPresets';
import { SectionPanel } from './SectionPanel';

declare global {
  interface Window {
    /** Test/debug hook — only installed in dev builds or with `?debug=1`. */
    __jnn?: { viewer: ThreeViewerAdapter; getState: () => unknown };
  }
}

const debugEnabled = () => import.meta.env.DEV || new URLSearchParams(location.search).has('debug');

export function Viewport({ model, onViewer, compact }: { model: JnnModel; onViewer: (v: ViewerAdapter | null) => void; compact: boolean }) {
  const { state, dispatch, viewer } = useApp();
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  // Create / dispose the adapter with the component.
  useEffect(() => {
    const host = hostRef.current!;
    let adapter: ThreeViewerAdapter;
    try {
      adapter = new ThreeViewerAdapter();
      adapter.mount(host);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    let cancelled = false;
    const offPick = adapter.on('pick', ({ result, additive }) => {
      if (!result) {
        if (!additive) dispatch({ type: 'clearSelection' });
        return;
      }
      dispatch({ type: 'select', ids: [result.elementId], mode: additive ? 'toggle' : 'replace', reveal: true });
    });
    const offHover = adapter.on('hover', ({ elementId }) => dispatch({ type: 'hover', id: elementId }));
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
    return () => {
      cancelled = true;
      offPick();
      offHover();
      onViewer(null);
      adapter.dispose();
      if (window.__jnn?.viewer === adapter) delete window.__jnn;
    };
  }, [model, dispatch, onViewer]);

  // State → viewer synchronisation. Each effect reports adapter failures.
  const report = (r: { ok: boolean; message?: string } | undefined) => {
    if (r && !r.ok) dispatch({ type: 'notify', tone: 'warning', text: r.message ?? 'Viewer operation failed.' });
  };
  useEffect(() => report(viewer?.select(state.selection)), [viewer, state.selection]);
  useEffect(() => {
    if (!viewer) return;
    report(viewer.setHidden([...state.visibility.hidden]));
    report(viewer.isolate([...state.visibility.isolated]));
  }, [viewer, state.visibility]);
  useEffect(() => report(viewer?.setSection(state.section)), [viewer, state.section]);
  useEffect(() => report(viewer?.setXray(state.xray)), [viewer, state.xray]);
  useEffect(() => report(viewer?.setProjection(state.projection)), [viewer, state.projection]);
  useEffect(() => viewer?.setTheme(state.theme), [viewer, state.theme]);

  const hovered = state.hovered ? state.byId.get(state.hovered) : null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div ref={hostRef} className="absolute inset-0" data-testid="viewer-host" data-status={status} />
      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center text-muted">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="animate-spin" size={16} /> Loading model…
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
          <ViewPresets />
          {state.section && <SectionPanel compact={compact} />}
          <Toolbar compact={compact} />
          {hovered && !compact && (
            <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-md bg-surface/90 px-2.5 py-1 text-xs text-muted shadow-float backdrop-blur">
              <span className="text-ink">{hovered.category}</span> · {hovered.name}
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useEffect } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { cn } from '../lib/cn';

export function Notices() {
  const { state, dispatch } = useApp();
  const latest = state.notices[state.notices.length - 1];
  useEffect(() => {
    if (!latest) return;
    const t = setTimeout(() => dispatch({ type: 'dismissNotice', id: latest.id }), 3500);
    return () => clearTimeout(t);
  }, [latest, dispatch]);
  if (!latest) return null;
  const Icon = latest.tone === 'info' ? Info : AlertTriangle;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-20 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-md items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-float">
        <Icon size={15} className={cn('shrink-0', latest.tone === 'info' ? 'text-muted' : latest.tone === 'error' ? 'text-danger' : 'text-warn')} />
        <span>{latest.text}</span>
        <button type="button" aria-label="Dismiss" className="ml-1 text-faint hover:text-ink" onClick={() => dispatch({ type: 'dismissNotice', id: latest.id })}>
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

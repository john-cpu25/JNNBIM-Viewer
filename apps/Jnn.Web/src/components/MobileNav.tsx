import { Box, ListTree, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../state/AppContext';
import type { MobilePane } from '../state/store';
import { cn } from '../lib/cn';

const TABS: { id: MobilePane; label: string; icon: typeof Box }[] = [
  { id: 'explorer', label: 'Model', icon: ListTree },
  { id: 'viewer', label: 'Viewer', icon: Box },
  { id: 'properties', label: 'Properties', icon: SlidersHorizontal },
];

export function MobileNav() {
  const { state, dispatch } = useApp();
  return (
    <nav
      aria-label="Panels"
      className="grid shrink-0 grid-cols-3 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map((t) => {
        const active = state.mobilePane === t.id;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={active}
            onClick={() => dispatch({ type: 'setMobilePane', pane: t.id })}
            className={cn('flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', active ? 'text-accent-ink' : 'text-muted')}
          >
            <t.icon size={19} strokeWidth={1.75} />
            {t.label}
            {t.id === 'properties' && state.selection.length > 0 && (
              <span className="sr-only">({state.selection.length} selected)</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

import { Zap } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { Properties } from './Properties';
import { ClashPanel } from './ClashPanel';
import { cn } from '../lib/cn';

export function RightPanel() {
  const { state, dispatch } = useApp();
  const activeTab = state.rightTab;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col" data-testid="right-panel">
      {/* Tab Switcher Header */}
      <div className="flex h-[41px] shrink-0 items-center justify-between border-b border-line px-3 bg-surface">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="tab-properties-btn"
            onClick={() => dispatch({ type: 'setRightTab', tab: 'properties' })}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide transition-colors',
              activeTab === 'properties'
                ? 'bg-surface-2 text-ink shadow-sm'
                : 'text-muted hover:text-ink',
            )}
          >
            <span>Properties</span>
            {state.selection.length > 1 && (
              <span className="rounded bg-surface-3 px-1.5 text-[10.5px] text-muted tabular">
                {state.selection.length}
              </span>
            )}
          </button>
          <button
            type="button"
            data-testid="tab-clash-btn"
            onClick={() => dispatch({ type: 'setRightTab', tab: 'clash' })}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide transition-colors',
              activeTab === 'clash'
                ? 'bg-surface-2 text-accent shadow-sm'
                : 'text-muted hover:text-ink',
            )}
          >
            <Zap size={13} className={activeTab === 'clash' ? 'text-accent' : 'text-muted'} />
            <span>Clash</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-0 flex-1 flex flex-col">
        {activeTab === 'clash' ? <ClashPanel /> : <Properties hideHeader />}
      </div>
    </div>
  );
}

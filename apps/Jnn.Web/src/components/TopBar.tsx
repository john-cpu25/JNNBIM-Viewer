import { Moon, PanelLeft, PanelRight, Sun } from 'lucide-react';
import { useApp } from '../state/AppContext';
import type { Layout } from '../lib/useLayout';
import { IconButton } from './ui';

export function TopBar({ layout }: { layout: Layout }) {
  const { state, dispatch } = useApp();
  const m = state.model;
  const narrow = layout === 'narrow';
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 sm:px-3">
      {!narrow && (
        <IconButton
          icon={PanelLeft}
          label="Toggle model explorer"
          active={state.explorerOpen}
          onClick={() => dispatch({ type: 'togglePanel', panel: 'explorer' })}
        />
      )}
      <div className="flex items-center gap-2 pr-1">
        <Logo />
        <span className="text-[13px] font-semibold tracking-tight">JNN</span>
      </div>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
        <span className="hidden truncate md:inline">{m.projectName}</span>
        <span className="hidden text-faint md:inline">/</span>
        <span className="truncate font-medium text-ink">{m.name}</span>
        <span className="hidden rounded border border-line px-1.5 font-mono text-[10.5px] sm:inline">{m.modelRevisionId}</span>
        <span
          className="rounded bg-accent-soft px-1.5 font-mono text-[10.5px] font-medium text-accent-ink"
          title="Procedural sample data — not loaded from a model file"
        >
          {m.sourceFormat}
        </span>
      </nav>
      <div className="ml-auto flex items-center gap-1">
        <IconButton
          icon={state.theme === 'dark' ? Sun : Moon}
          label={state.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => dispatch({ type: 'setTheme', theme: state.theme === 'dark' ? 'light' : 'dark' })}
          data-testid="theme-toggle"
        />
        {!narrow && (
          <IconButton
            icon={PanelRight}
            label="Toggle properties"
            active={state.propertiesOpen}
            onClick={() => dispatch({ type: 'togglePanel', panel: 'properties' })}
          />
        )}
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden>
      <path d="M8 22V12l8-4 8 4v10l-8 4z" fill="none" stroke="var(--jnn-accent)" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M8 12l8 4 8-4M16 16v10" fill="none" stroke="var(--jnn-accent)" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

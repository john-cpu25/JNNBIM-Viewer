import { useMemo } from 'react';
import { useApp } from '../state/AppContext';
import { visibleIds } from '../domain/visibility';
import { formatNumber } from '../lib/format';

export function StatusBar() {
  const { state, viewer } = useApp();
  const total = state.model.elements.length;
  const visible = useMemo(
    () => visibleIds(state.model.elements.map((e) => e.id), state.visibility).size,
    [state.model, state.visibility],
  );
  const s = state.section;
  const sectionText = !s ? null : s.kind === 'plane' ? `Section ${s.axis.toUpperCase()} @ ${s.offset.toFixed(2)} m` : 'Section box';
  return (
    <footer
      className="flex h-6 shrink-0 items-center gap-4 border-t border-line bg-surface px-3 text-[11px] text-muted tabular"
      data-testid="status-bar"
    >
      <span>
        Elements <b className="font-medium text-ink">{formatNumber(total)}</b>
      </span>
      <span data-testid="status-visible">
        Visible <b className="font-medium text-ink">{formatNumber(visible)}</b>
      </span>
      <span data-testid="status-selected">
        Selected <b className="font-medium text-ink">{state.selection.length}</b>
      </span>
      {state.visibility.isolated.size > 0 && <span className="text-accent-ink">Isolated</span>}
      {sectionText && <span className="text-accent-ink">{sectionText}</span>}
      {state.xray && <span className="text-accent-ink">X-ray</span>}
      <span className="ml-auto hidden lg:inline">Units: {state.model.units} · Z-up</span>
      <span className="hidden lg:inline">{state.projection === 'perspective' ? 'Perspective' : 'Orthographic'}</span>
      <span className="hidden lg:inline">Renderer: {viewer?.id ?? '—'}</span>
    </footer>
  );
}

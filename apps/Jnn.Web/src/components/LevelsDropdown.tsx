import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Layers } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { useTranslation } from '../i18n';
import { boundsOf, isEmpty } from '../domain/bounds';
import { boxForStorey } from '../viewer/sectionMath';
import type { Storey } from '../domain/model';
import { cn } from '../lib/cn';

export function LevelsDropdown() {
  const { state, dispatch, viewer } = useApp();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [ghostOthers, setGhostOthers] = useState(false);
  const [applySection, setApplySection] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const storeys = state.model.storeys;
  const activeStorey = storeys.find((s) => s.id === state.selectedStoreyId);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  if (storeys.length === 0) return null;

  const handleSelectAll = () => {
    if (viewer) {
      viewer.isolate([]);
      viewer.setHidden([]);
      viewer.setXray(false);
      if (applySection) {
        viewer.setSection(null);
      }
    }
    dispatch({ type: 'selectStorey', storeyId: null, applySection });
    setOpen(false);
  };

  const handleSelectStorey = (s: Storey) => {
    const ids = state.model.elements
      .filter((e) => (s.name && e.storey === s.name) || e.storey === s.id)
      .map((e) => e.id);

    if (viewer) {
      viewer.isolate(ids);
      viewer.setXray(ghostOthers);
      if (applySection) {
        const idx = storeys.findIndex((st) => st.id === s.id);
        const b = boundsOf(state.model.elements);
        if (!isEmpty(b)) {
          const box = boxForStorey(storeys, idx, b, b);
          viewer.setSection({ kind: 'box', min: box.min, max: box.max });
        }
      }
    }
    dispatch({ type: 'selectStorey', storeyId: s.id, ghostOthers, applySection });
    setOpen(false);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        data-testid="levels-dropdown-btn"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
          activeStorey
            ? 'bg-accent-soft text-accent-ink hover:bg-accent-soft'
            : 'text-muted hover:bg-surface-3 hover:text-ink',
        )}
        title={t('toolbar.levels')}
      >
        <Layers size={15} />
        <span className="max-w-[100px] truncate">{activeStorey ? activeStorey.name : t('levels.all')}</span>
        <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          data-testid="levels-dropdown-menu"
          className="absolute bottom-full left-0 mb-1.5 w-52 rounded-lg border border-line bg-surface p-1 shadow-float backdrop-blur z-50 pointer-events-auto"
        >
          <div className="px-2 py-1 text-[11px] font-semibold text-muted tracking-wide">
            {t('toolbar.levels')}
          </div>

          <button
            type="button"
            data-testid="level-item-all"
            onClick={handleSelectAll}
            className={cn(
              'flex w-full items-center justify-between rounded-md px-2 py-1 text-xs transition-colors hover:bg-surface-2',
              !activeStorey && 'font-semibold text-accent',
            )}
          >
            <span>{t('levels.all')}</span>
            {!activeStorey && <Check size={13} />}
          </button>

          <div className="my-1 border-t border-line" />

          <div className="max-h-48 overflow-y-auto space-y-0.5 scroll-thin">
            {storeys.map((s) => {
              const isSelected = s.id === state.selectedStoreyId;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-testid="level-item"
                  onClick={() => handleSelectStorey(s)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2 py-1 text-xs transition-colors hover:bg-surface-2',
                    isSelected && 'font-semibold text-accent',
                  )}
                >
                  <span className="truncate">{s.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted tabular">{s.elevation}m</span>
                    {isSelected && <Check size={13} />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="my-1 border-t border-line" />

          <div className="p-1 space-y-1">
            <label className="flex items-center gap-2 rounded px-1.5 py-1 text-[11px] text-ink hover:bg-surface-2 cursor-pointer">
              <input
                type="checkbox"
                data-testid="levels-ghost-checkbox"
                checked={ghostOthers}
                onChange={(e) => {
                  setGhostOthers(e.target.checked);
                  if (activeStorey && viewer) {
                    viewer.setXray(e.target.checked);
                    dispatch({ type: 'setXray', enabled: e.target.checked });
                  }
                }}
                className="rounded border-line"
              />
              <span>{t('levels.ghostOthers')}</span>
            </label>

            <label className="flex items-center gap-2 rounded px-1.5 py-1 text-[11px] text-ink hover:bg-surface-2 cursor-pointer">
              <input
                type="checkbox"
                data-testid="levels-section-checkbox"
                checked={applySection}
                onChange={(e) => setApplySection(e.target.checked)}
                className="rounded border-line"
              />
              <span>Section box</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

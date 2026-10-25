import { useEffect, useMemo, useReducer, useState } from 'react';
import { createSampleModel } from './domain/sampleModel';
import { AppContext } from './state/AppContext';
import { createInitialState, reducer } from './state/store';
import { applyTheme, initialTheme } from './lib/theme';
import { readLayout, useLayout } from './lib/useLayout';
import { useShortcuts } from './lib/useShortcuts';
import type { ViewerAdapter } from './viewer/ViewerAdapter';
import { TopBar } from './components/TopBar';
import { Explorer } from './components/Explorer';
import { Properties } from './components/Properties';
import { Viewport } from './components/Viewport';
import { StatusBar } from './components/StatusBar';
import { MobileNav } from './components/MobileNav';
import { Notices } from './components/Notices';
import { cn } from './lib/cn';

export default function App() {
  const model = useMemo(() => createSampleModel(), []);
  const layout = useLayout();
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const s = createInitialState(model, initialTheme());
    // Side panels start closed on tablets so the model is visible first.
    return readLayout() === 'wide' ? s : { ...s, explorerOpen: false, propertiesOpen: false };
  });
  const [viewer, setViewer] = useState<ViewerAdapter | null>(null);

  useEffect(() => applyTheme(state.theme), [state.theme]);
  useShortcuts(state, dispatch, viewer);

  const ctx = useMemo(() => ({ state, dispatch, viewer }), [state, viewer]);

  const isWide = layout === 'wide';
  const isNarrow = layout === 'narrow';
  const showExplorer = isNarrow ? state.mobilePane === 'explorer' : state.explorerOpen;
  const showProperties = isNarrow ? state.mobilePane === 'properties' : state.propertiesOpen;

  // Wide: docked columns. Medium: floating drawers over the viewport.
  // Narrow: full-height sheets switched by the bottom navigation.
  const panelClass = (side: 'left' | 'right') =>
    cn(
      'flex min-h-0 flex-col bg-surface',
      isWide && 'relative z-10 shrink-0 border-line',
      isWide && (side === 'left' ? 'w-[300px] border-r' : 'w-[340px] border-l'),
      layout === 'medium' &&
        cn(
          'absolute top-2 bottom-2 z-30 w-[320px] rounded-lg border border-line shadow-float',
          side === 'left' ? 'left-2' : 'right-2',
        ),
      isNarrow && 'absolute inset-0 z-30',
    );

  return (
    <AppContext.Provider value={ctx}>
      <div className="flex h-full flex-col" data-layout={layout}>
        <TopBar layout={layout} />
        <main className="relative flex min-h-0 flex-1">
          {showExplorer && (
            <aside className={panelClass('left')} aria-label="Model explorer" data-testid="explorer-panel">
              <Explorer />
            </aside>
          )}
          <section className="relative min-w-0 flex-1" aria-label="3D viewer">
            <Viewport model={model} onViewer={setViewer} compact={isNarrow} />
          </section>
          {showProperties && (
            <aside className={panelClass('right')} aria-label="Properties" data-testid="properties-panel">
              <Properties />
            </aside>
          )}
          <Notices />
        </main>
        {isNarrow ? <MobileNav /> : <StatusBar />}
      </div>
    </AppContext.Provider>
  );
}

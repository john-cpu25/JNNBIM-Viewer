import {
  Box,
  Camera,
  Crosshair,
  Eye,
  EyeOff,
  Focus,
  Footprints,
  Ghost,
  Grid3x3,
  Maximize,
  Ruler,
  Scissors,
  SquareDashed,
  View,
  XCircle,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import { runCommand, type CommandId } from '../lib/commands';
import { Divider, IconButton } from './ui';
import { LevelsDropdown } from './LevelsDropdown';
import { cn } from '../lib/cn';
import { useTranslation } from '../i18n';

export function Toolbar({ compact }: { compact: boolean }) {
  const { state, dispatch, viewer } = useApp();
  const { t } = useTranslation();
  const run = (id: CommandId) => runCommand(id, state, dispatch, viewer);
  const hasSel = state.selection.length > 0;
  const anyHidden = state.visibility.hidden.size > 0 || state.visibility.isolated.size > 0;

  return (
    <div
      role="toolbar"
      aria-label="Viewer tools"
      data-testid="viewer-toolbar"
      className={cn(
        'absolute left-1/2 z-30 flex max-w-[calc(100%-16px)] -translate-x-1/2 items-center gap-0.5 overflow-visible rounded-lg border border-line bg-surface/95 p-1 shadow-float backdrop-blur',
        compact ? 'bottom-2' : 'bottom-4',
      )}
    >
      <IconButton icon={Maximize} label={t('toolbar.fitAll')} shortcut="F" onClick={() => run('fitAll')} />
      <IconButton icon={Crosshair} label={t('toolbar.fitSelection')} shortcut="F" disabled={!hasSel} onClick={() => run('fit')} />
      <Divider vertical />
      <IconButton
        icon={EyeOff}
        label={t('toolbar.hide')}
        shortcut="H"
        disabled={!hasSel || !viewer?.capabilities.has('visibility')}
        onClick={() => run('hide')}
      />
      <IconButton
        icon={Focus}
        label={t('toolbar.isolate')}
        shortcut="I"
        disabled={!hasSel || !viewer?.capabilities.has('isolate')}
        onClick={() => run('isolate')}
      />
      <IconButton
        icon={Eye}
        label={t('toolbar.showAll')}
        shortcut="A"
        disabled={!anyHidden || !viewer?.capabilities.has('visibility')}
        onClick={() => run('showAll')}
      />
      <Divider vertical />
      <IconButton
        icon={Scissors}
        label={t('toolbar.sectionPlane')}
        shortcut="S"
        disabled={!viewer?.capabilities.has('sectionPlane')}
        active={state.section?.kind === 'plane'}
        onClick={() => run('sectionPlane')}
      />
      <IconButton
        icon={SquareDashed}
        label={t('toolbar.sectionBox')}
        shortcut="B"
        disabled={!viewer?.capabilities.has('sectionBox')}
        active={state.section?.kind === 'box'}
        onClick={() => run('sectionBox')}
      />
      <IconButton
        icon={Ghost}
        label={t('toolbar.xray')}
        shortcut="X"
        disabled={!viewer?.capabilities.has('xray')}
        active={state.xray}
        onClick={() => run('xray')}
      />
      <IconButton
        icon={state.projection === 'perspective' ? View : Box}
        label={t('toolbar.projection')}
        shortcut="P"
        active={state.projection === 'orthographic'}
        onClick={() => run('projection')}
      />
      <IconButton
        icon={Grid3x3}
        label={t('toolbar.grid')}
        shortcut="G"
        active={state.gridVisible}
        onClick={() => run('toggleGrid')}
        data-testid="toggle-grid-btn"
      />
      <IconButton
        icon={Ruler}
        label={t('toolbar.measure')}
        shortcut="M"
        disabled={!viewer?.capabilities.has('measure')}
        active={state.measurePanelOpen || state.measureTool !== null}
        onClick={() => run('toggleMeasure')}
        data-testid="toggle-measure-btn"
      />
      <IconButton
        icon={Footprints}
        label={state.walkMode ? t('toolbar.walkExit') : t('toolbar.walk')}
        disabled={!viewer?.capabilities.has('walk')}
        active={state.walkMode}
        onClick={() => run('toggleWalk')}
        data-testid="toggle-walk-btn"
      />
      <IconButton
        icon={Camera}
        label={t('toolbar.screenshot')}
        onClick={() => run('screenshot')}
        data-testid="screenshot-btn"
      />
      {state.model.storeys.length > 0 && (
        <>
          <Divider vertical />
          <LevelsDropdown />
        </>
      )}
      {hasSel && (
        <>
          <Divider vertical />
          <div className="flex items-center gap-1 pl-1" data-testid="selection-badge">
            <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[11px] font-semibold text-accent tabular">
              {state.selection.length}
            </span>
            <IconButton icon={XCircle} label={t('toolbar.clearSelection')} shortcut="Esc" onClick={() => run('clear')} />
          </div>
        </>
      )}
    </div>
  );
}

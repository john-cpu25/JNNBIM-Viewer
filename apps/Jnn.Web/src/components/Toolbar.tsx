import {
  Box,
  Crosshair,
  Eye,
  EyeOff,
  Focus,
  Ghost,
  Maximize,
  Scissors,
  SquareDashed,
  View,
  XCircle,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import { runCommand, type CommandId } from '../lib/commands';
import { Divider, IconButton } from './ui';
import { cn } from '../lib/cn';

export function Toolbar({ compact }: { compact: boolean }) {
  const { state, dispatch, viewer } = useApp();
  const run = (id: CommandId) => runCommand(id, state, dispatch, viewer);
  const hasSel = state.selection.length > 0;
  const anyHidden = state.visibility.hidden.size > 0 || state.visibility.isolated.size > 0;

  return (
    <div
      role="toolbar"
      aria-label="Viewer tools"
      data-testid="viewer-toolbar"
      className={cn(
        'absolute left-1/2 z-20 flex max-w-[calc(100%-16px)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-lg border border-line bg-surface/95 p-1 shadow-float backdrop-blur scroll-thin',
        compact ? 'bottom-2' : 'bottom-4',
      )}
    >
      <IconButton icon={Maximize} label="Fit all" shortcut="F" onClick={() => run('fitAll')} />
      <IconButton icon={Crosshair} label="Fit selection" shortcut="F" disabled={!hasSel} onClick={() => run('fit')} />
      <Divider vertical />
      <IconButton
        icon={EyeOff}
        label={viewer?.capabilities.has('visibility') ? 'Hide selected' : 'Hide selected (Có ở T07)'}
        shortcut="H"
        disabled={!hasSel || !viewer?.capabilities.has('visibility')}
        onClick={() => run('hide')}
      />
      <IconButton
        icon={Focus}
        label={viewer?.capabilities.has('isolate') ? 'Isolate selected' : 'Isolate selected (Có ở T07)'}
        shortcut="I"
        disabled={!hasSel || !viewer?.capabilities.has('isolate')}
        onClick={() => run('isolate')}
      />
      <IconButton
        icon={Eye}
        label={viewer?.capabilities.has('visibility') ? 'Show all' : 'Show all (Có ở T07)'}
        shortcut="A"
        disabled={!anyHidden || !viewer?.capabilities.has('visibility')}
        onClick={() => run('showAll')}
      />
      <Divider vertical />
      <IconButton
        icon={Scissors}
        label={viewer?.capabilities.has('sectionPlane') ? 'Section plane' : 'Section plane (Có ở T08)'}
        shortcut="S"
        disabled={!viewer?.capabilities.has('sectionPlane')}
        active={state.section?.kind === 'plane'}
        onClick={() => run('sectionPlane')}
      />
      <IconButton
        icon={SquareDashed}
        label={
          viewer?.capabilities.has('sectionBox')
            ? hasSel
              ? 'Section box around selection'
              : 'Section box'
            : 'Section box (Có ở T08)'
        }
        shortcut="B"
        disabled={!viewer?.capabilities.has('sectionBox')}
        active={state.section?.kind === 'box'}
        onClick={() => run('sectionBox')}
      />
      <IconButton
        icon={Ghost}
        label={viewer?.capabilities.has('xray') ? 'X-ray' : 'X-ray (Có ở T07)'}
        shortcut="X"
        disabled={!viewer?.capabilities.has('xray')}
        active={state.xray}
        onClick={() => run('xray')}
      />
      <IconButton
        icon={state.projection === 'perspective' ? View : Box}
        label={state.projection === 'perspective' ? 'Switch to orthographic' : 'Switch to perspective'}
        shortcut="P"
        active={state.projection === 'orthographic'}
        onClick={() => run('projection')}
      />
      {hasSel && (
        <>
          <Divider vertical />
          <IconButton icon={XCircle} label="Clear selection" shortcut="Esc" onClick={() => run('clear')} />
        </>
      )}
    </div>
  );
}

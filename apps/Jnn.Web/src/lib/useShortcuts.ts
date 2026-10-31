import { useEffect, useRef, type Dispatch } from 'react';
import type { Action, AppState } from '../state/store';
import type { ViewerAdapter, ViewPreset } from '../viewer/ViewerAdapter';
import { runCommand, type CommandId } from './commands';

const KEYMAP: Record<string, CommandId> = {
  f: 'fit',
  h: 'hide',
  i: 'isolate',
  a: 'showAll',
  x: 'xray',
  s: 'sectionPlane',
  b: 'sectionBox',
  p: 'projection',
  g: 'toggleGrid',
  m: 'toggleMeasure',
  escape: 'clear',
};

const PRESET_KEYS: Record<string, ViewPreset> = { '1': 'iso', '2': 'top', '3': 'front', '4': 'right', '5': 'back', '6': 'left' };

export function useShortcuts(state: AppState, dispatch: Dispatch<Action>, viewer: ViewerAdapter | null) {
  const ref = useRef({ state, viewer });
  ref.current = { state, viewer };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        if (e.key === 'Escape') t.blur();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        runCommand('selectAll', ref.current.state, dispatch, ref.current.viewer);
        return;
      }
      if (e.key === 'F11' || (e.shiftKey && e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        if (typeof document !== 'undefined') {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch?.(() => {});
          } else {
            document.exitFullscreen?.().catch?.(() => {});
          }
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const { state: s, viewer: v } = ref.current;
      const preset = PRESET_KEYS[key];
      if (preset) {
        v?.setViewPreset(preset);
        e.preventDefault();
        return;
      }
      const cmd = KEYMAP[key];
      if (!cmd) return;
      e.preventDefault();
      runCommand(cmd, s, dispatch, v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);
}


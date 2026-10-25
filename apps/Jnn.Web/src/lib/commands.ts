import type { Dispatch } from 'react';
import type { Action, AppState } from '../state/store';
import { defaultPlane } from '../state/store';
import { boundsOf, pad } from '../domain/bounds';
import type { ViewerAdapter, ViewerCapability } from '../viewer/ViewerAdapter';

export type CommandId =
  | 'fit'
  | 'fitAll'
  | 'hide'
  | 'isolate'
  | 'showAll'
  | 'xray'
  | 'sectionPlane'
  | 'sectionBox'
  | 'projection'
  | 'clear';

export const COMMAND_CAPABILITY: Partial<Record<CommandId, ViewerCapability>> = {
  fit: 'fitToView',
  fitAll: 'fitToView',
  hide: 'visibility',
  isolate: 'isolate',
  showAll: 'visibility',
  xray: 'xray',
  sectionPlane: 'sectionPlane',
  sectionBox: 'sectionBox',
  projection: 'camera',
};

/**
 * Execute a viewer command. Shared by the toolbar and keyboard shortcuts so
 * both paths behave identically. Unsupported capabilities produce a visible
 * notice instead of failing silently.
 */
export function runCommand(id: CommandId, s: AppState, dispatch: Dispatch<Action>, v: ViewerAdapter | null): void {
  const cap = COMMAND_CAPABILITY[id];
  if (cap && v && !v.capabilities.has(cap)) {
    dispatch({ type: 'notify', tone: 'warning', text: `“${cap}” is not supported by the ${v.id} viewer.` });
    return;
  }
  const sel = s.selection;
  const needSelection = (verb: string) =>
    dispatch({ type: 'notify', tone: 'info', text: `Select one or more elements to ${verb}.` });

  switch (id) {
    case 'fit': {
      const r = v?.fitToView(sel.length ? sel : undefined);
      if (r && !r.ok) dispatch({ type: 'notify', tone: 'warning', text: r.message });
      return;
    }
    case 'fitAll': {
      const r = v?.fitToView();
      if (r && !r.ok) dispatch({ type: 'notify', tone: 'warning', text: r.message });
      return;
    }
    case 'hide':
      if (!sel.length) return needSelection('hide');
      dispatch({ type: 'hide', ids: sel });
      return;
    case 'isolate':
      if (!sel.length) return needSelection('isolate');
      dispatch({ type: 'isolate', ids: sel });
      return;
    case 'showAll':
      dispatch({ type: 'showAll' });
      return;
    case 'xray':
      dispatch({ type: 'toggleXray' });
      return;
    case 'sectionPlane': {
      if (s.section?.kind === 'plane') return dispatch({ type: 'setSection', section: null });
      const b = boundsOf(s.model.elements);
      dispatch({ type: 'setSection', section: defaultPlane('z', b) });
      return;
    }
    case 'sectionBox': {
      if (s.section?.kind === 'box') return dispatch({ type: 'setSection', section: null });
      const els = sel.length ? sel.map((id) => s.byId.get(id)!).filter(Boolean) : s.model.elements;
      const b = pad(boundsOf(els), sel.length ? 0.6 : 0.01);
      dispatch({ type: 'setSection', section: { kind: 'box', min: b.min, max: b.max } });
      return;
    }
    case 'projection':
      dispatch({ type: 'setProjection', projection: s.projection === 'perspective' ? 'orthographic' : 'perspective' });
      return;
    case 'clear':
      dispatch({ type: 'clearSelection' });
      return;
  }
}

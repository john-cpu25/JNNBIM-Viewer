import type { Dispatch } from 'react';
import type { Action, AppState } from '../state/store';
import { defaultPlane } from '../state/store';
import { boundsOf, isEmpty, pad } from '../domain/bounds';
import { isVisible } from '../domain/visibility';
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
  | 'toggleGrid'
  | 'selectAll'
  | 'toggleMeasure'
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
  toggleMeasure: 'measure',
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
      const modelKey = s.model.modelId || 'default';
      const lastPlane = s.lastSectionPlane?.[modelKey];
      if (lastPlane) {
        dispatch({ type: 'setSection', section: lastPlane });
        return;
      }
      let b = boundsOf(s.model.elements);
      if (isEmpty(b)) {
        const vb = v?.getModelBounds();
        if (vb?.ok) b = vb.value;
      }
      if (isEmpty(b)) {
        b = { min: [-10, -10, 0], max: [10, 10, 10] };
      }
      dispatch({ type: 'setSection', section: defaultPlane('z', b, s.model?.storeys) });
      return;
    }
    case 'sectionBox': {
      if (s.section?.kind === 'box') return dispatch({ type: 'setSection', section: null });
      if (sel.length) {
        const els = sel.map((id) => s.byId.get(id)!).filter(Boolean);
        let b = boundsOf(els);
        if (isEmpty(b)) {
          const vb = v?.getModelBounds();
          if (vb?.ok) b = vb.value;
        }
        if (isEmpty(b)) {
          b = { min: [-10, -10, 0], max: [10, 10, 10] };
        }
        const pb = pad(b, 0.6);
        dispatch({ type: 'setSection', section: { kind: 'box', min: pb.min, max: pb.max } });
        return;
      }
      const modelKey = s.model.modelId || 'default';
      const lastBox = s.lastSectionBox?.[modelKey];
      if (lastBox) {
        dispatch({ type: 'setSection', section: { kind: 'box', min: lastBox.min, max: lastBox.max } });
        return;
      }
      let b = boundsOf(s.model.elements);
      if (isEmpty(b)) {
        const vb = v?.getModelBounds();
        if (vb?.ok) b = vb.value;
      }
      if (isEmpty(b)) {
        b = { min: [-10, -10, 0], max: [10, 10, 10] };
      }
      const pb = pad(b, 0.01);
      dispatch({ type: 'setSection', section: { kind: 'box', min: pb.min, max: pb.max } });
      return;
    }
    case 'projection':
      dispatch({ type: 'setProjection', projection: s.projection === 'perspective' ? 'orthographic' : 'perspective' });
      return;
    case 'toggleGrid':
      dispatch({ type: 'toggleGrid' });
      return;
    case 'selectAll': {
      const visibleIds: string[] = [];
      const section = s.section;
      for (const el of s.model.elements) {
        if (!isVisible(el.id, s.visibility)) continue;
        if (section) {
          const elBounds = boundsOf([el]);
          if (!isEmpty(elBounds)) {
            if (section.kind === 'box') {
              if (
                elBounds.max[0] < section.min[0] || elBounds.min[0] > section.max[0] ||
                elBounds.max[1] < section.min[1] || elBounds.min[1] > section.max[1] ||
                elBounds.max[2] < section.min[2] || elBounds.min[2] > section.max[2]
              ) {
                continue;
              }
            } else if (section.kind === 'plane') {
              const axisIdx = section.axis === 'x' ? 0 : section.axis === 'y' ? 1 : 2;
              const offset = section.offset;
              if (section.flipped) {
                if (elBounds.min[axisIdx] > offset) continue;
              } else {
                if (elBounds.max[axisIdx] < offset) continue;
              }
            }
          }
        }
        visibleIds.push(el.id);
      }
      if (visibleIds.length > 0) {
        dispatch({ type: 'select', ids: visibleIds, mode: 'replace' });
      }
      return;
    }
    case 'toggleMeasure':
      dispatch({ type: 'setMeasurePanelOpen', open: !s.measurePanelOpen });
      return;
    case 'clear':
      if (s.measureTool !== null || s.measurePanelOpen) {
        dispatch({ type: 'setMeasurePanelOpen', open: false });
        return;
      }
      if (s.sectionPickMode) {
        dispatch({ type: 'setSectionPickMode', on: false });
        return;
      }
      dispatch({ type: 'clearSelection' });
      return;
  }
}

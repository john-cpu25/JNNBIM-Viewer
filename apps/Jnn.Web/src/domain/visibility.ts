/**
 * Pure visibility rules shared by the viewer adapter and the UI.
 *
 * - `hidden` elements are never shown.
 * - When `isolated` is non-empty, only isolated elements (minus hidden) are shown.
 */
export interface VisibilityState {
  hidden: ReadonlySet<string>;
  isolated: ReadonlySet<string>;
}

export const EMPTY_VISIBILITY: VisibilityState = { hidden: new Set(), isolated: new Set() };

export function isVisible(id: string, v: VisibilityState): boolean {
  if (v.hidden.has(id)) return false;
  if (v.isolated.size > 0 && !v.isolated.has(id)) return false;
  return true;
}

export function visibleIds(all: Iterable<string>, v: VisibilityState): Set<string> {
  const out = new Set<string>();
  for (const id of all) if (isVisible(id, v)) out.add(id);
  return out;
}

export type NodeVisibility = 'visible' | 'hidden' | 'partial';

export function groupVisibility(ids: readonly string[], v: VisibilityState): NodeVisibility {
  let shown = 0;
  for (const id of ids) if (isVisible(id, v)) shown++;
  if (shown === 0) return 'hidden';
  if (shown === ids.length) return 'visible';
  return 'partial';
}

export function hide(v: VisibilityState, ids: Iterable<string>): VisibilityState {
  const hidden = new Set(v.hidden);
  for (const id of ids) hidden.add(id);
  return { hidden, isolated: v.isolated };
}

/**
 * Make ids visible again. If an isolation is active and an id is outside it,
 * it is added to the isolation set so the action has a visible effect.
 */
export function show(v: VisibilityState, ids: Iterable<string>): VisibilityState {
  const hidden = new Set(v.hidden);
  const isolated = v.isolated.size ? new Set(v.isolated) : v.isolated;
  for (const id of ids) {
    hidden.delete(id);
    if (isolated.size) (isolated as Set<string>).add(id);
  }
  return { hidden, isolated };
}

export function isolate(ids: Iterable<string>): VisibilityState {
  return { hidden: new Set(), isolated: new Set(ids) };
}

/** Toggle a group: if fully visible → hide all, otherwise → show all. */
export function toggleGroup(v: VisibilityState, ids: readonly string[]): VisibilityState {
  return groupVisibility(ids, v) === 'visible' ? hide(v, ids) : show(v, ids);
}

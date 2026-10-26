import type { JnnElement, JnnModel } from '../domain/model';
import { indexElements } from '../domain/model';
import {
  allBranchIds,
  ancestorIds,
  buildTree,
  defaultExpanded,
  type TreeMode,
  type TreeNode,
} from '../domain/tree';
import { EMPTY_VISIBILITY, hide, isolate, show, toggleGroup, type VisibilityState } from '../domain/visibility';
import type { SectionAxis, SectionSpec, Vec3 } from '../viewer/ViewerAdapter';

export type Theme = 'light' | 'dark';
export type MobilePane = 'explorer' | 'viewer' | 'properties';

export interface Notice {
  id: number;
  tone: 'info' | 'warning' | 'error';
  text: string;
}

export interface AppState {
  model: JnnModel;
  byId: Map<string, JnnElement>;
  trees: Record<TreeMode, TreeNode>;
  treeMode: TreeMode;
  expanded: Record<TreeMode, Set<string>>;
  search: string;
  /** Ordered; last item is the "primary" selection shown in Properties. */
  selection: string[];
  hovered: string | null;
  visibility: VisibilityState;
  section: SectionSpec | null;
  xray: boolean;
  projection: 'perspective' | 'orthographic';
  theme: Theme;
  explorerOpen: boolean;
  propertiesOpen: boolean;
  mobilePane: MobilePane;
  notices: Notice[];
}

export type Action =
  | { type: 'select'; ids: string[]; mode?: 'replace' | 'toggle' | 'add'; reveal?: boolean }
  | { type: 'clearSelection' }
  | { type: 'hover'; id: string | null }
  | { type: 'hide'; ids: string[] }
  | { type: 'show'; ids: string[] }
  | { type: 'toggleGroupVisibility'; ids: string[] }
  | { type: 'isolate'; ids: string[] }
  | { type: 'showAll' }
  | { type: 'setTreeMode'; mode: TreeMode }
  | { type: 'toggleExpanded'; nodeId: string }
  | { type: 'expandAll' }
  | { type: 'collapseAll' }
  | { type: 'setSearch'; query: string }
  | { type: 'setSection'; section: SectionSpec | null }
  | { type: 'toggleXray' }
  | { type: 'setProjection'; projection: AppState['projection'] }
  | { type: 'setTheme'; theme: Theme }
  | { type: 'togglePanel'; panel: 'explorer' | 'properties'; open?: boolean }
  | { type: 'setMobilePane'; pane: MobilePane }
  | { type: 'notify'; tone: Notice['tone']; text: string }
  | { type: 'dismissNotice'; id: number }
  | { type: 'setModel'; model: JnnModel };

let noticeSeq = 1;

export function createInitialState(model: JnnModel, theme: Theme): AppState {
  const trees = { spatial: buildTree(model, 'spatial'), category: buildTree(model, 'category') };
  return {
    model,
    byId: indexElements(model),
    trees,
    treeMode: 'spatial',
    expanded: { spatial: defaultExpanded(trees.spatial), category: defaultExpanded(trees.category) },
    search: '',
    selection: [],
    hovered: null,
    visibility: EMPTY_VISIBILITY,
    section: null,
    xray: false,
    projection: 'perspective',
    theme,
    explorerOpen: true,
    propertiesOpen: true,
    mobilePane: 'viewer',
    notices: [],
  };
}

function revealInTrees(state: AppState, id: string): AppState['expanded'] {
  const next = { ...state.expanded };
  for (const mode of ['spatial', 'category'] as const) {
    const anc = ancestorIds(state.trees[mode], id);
    if (anc.every((a) => state.expanded[mode].has(a))) continue;
    const s = new Set(state.expanded[mode]);
    anc.forEach((a) => s.add(a));
    next[mode] = s;
  }
  return next;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'select': {
      const ids = action.ids.filter((id) => state.byId.has(id));
      let selection: string[];
      const mode = action.mode ?? 'replace';
      if (mode === 'replace') selection = ids;
      else if (mode === 'add') selection = [...state.selection.filter((s) => !ids.includes(s)), ...ids];
      else {
        const cur = new Set(state.selection);
        const allIn = ids.every((id) => cur.has(id));
        selection = allIn ? state.selection.filter((s) => !ids.includes(s)) : [...state.selection.filter((s) => !ids.includes(s)), ...ids];
      }
      const last = selection[selection.length - 1];
      const expanded = action.reveal && last && ids.length === 1 ? revealInTrees(state, last) : state.expanded;
      return { ...state, selection, expanded };
    }
    case 'clearSelection':
      return state.selection.length ? { ...state, selection: [] } : state;
    case 'hover':
      return state.hovered === action.id ? state : { ...state, hovered: action.id };
    case 'hide':
      return { ...state, visibility: hide(state.visibility, action.ids), selection: state.selection.filter((s) => !action.ids.includes(s)) };
    case 'show':
      return { ...state, visibility: show(state.visibility, action.ids) };
    case 'toggleGroupVisibility':
      return { ...state, visibility: toggleGroup(state.visibility, action.ids) };
    case 'isolate':
      return action.ids.length ? { ...state, visibility: isolate(action.ids) } : state;
    case 'showAll':
      return { ...state, visibility: EMPTY_VISIBILITY };
    case 'setTreeMode':
      return { ...state, treeMode: action.mode };
    case 'toggleExpanded': {
      const s = new Set(state.expanded[state.treeMode]);
      if (s.has(action.nodeId)) s.delete(action.nodeId);
      else s.add(action.nodeId);
      return { ...state, expanded: { ...state.expanded, [state.treeMode]: s } };
    }
    case 'expandAll':
      return { ...state, expanded: { ...state.expanded, [state.treeMode]: new Set(allBranchIds(state.trees[state.treeMode])) } };
    case 'collapseAll':
      return { ...state, expanded: { ...state.expanded, [state.treeMode]: defaultExpanded(state.trees[state.treeMode]) } };
    case 'setSearch':
      return { ...state, search: action.query };
    case 'setSection':
      return { ...state, section: action.section };
    case 'toggleXray':
      return { ...state, xray: !state.xray };
    case 'setProjection':
      return { ...state, projection: action.projection };
    case 'setTheme':
      return { ...state, theme: action.theme };
    case 'togglePanel': {
      const key = action.panel === 'explorer' ? 'explorerOpen' : 'propertiesOpen';
      return { ...state, [key]: action.open ?? !state[key] };
    }
    case 'setMobilePane':
      return { ...state, mobilePane: action.pane };
    case 'notify':
      return { ...state, notices: [...state.notices.slice(-3), { id: noticeSeq++, tone: action.tone, text: action.text }] };
    case 'dismissNotice':
      return { ...state, notices: state.notices.filter((n) => n.id !== action.id) };
    case 'setModel': {
      const initial = createInitialState(action.model, state.theme);
      return {
        ...initial,
        theme: state.theme,
        explorerOpen: state.explorerOpen,
        propertiesOpen: state.propertiesOpen,
        mobilePane: state.mobilePane,
      };
    }
  }
}

/** Default section plane for an axis: through the middle of the model. */
export function defaultPlane(axis: SectionAxis, bounds: { min: Vec3; max: Vec3 }): Extract<SectionSpec, { kind: 'plane' }> {
  const i = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const mid = (bounds.min[i]! + bounds.max[i]!) / 2;
  // For horizontal cuts, a plan-style cut ~1.2 m above the lowest floor is
  // more useful than the geometric middle.
  const offset = axis === 'z' ? Math.min(bounds.max[2], bounds.min[2] + 1.5) : mid;
  return { kind: 'plane', axis, offset: Math.round(offset * 100) / 100, flipped: false };
}

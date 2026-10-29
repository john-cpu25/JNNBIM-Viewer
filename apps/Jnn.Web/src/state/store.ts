import type { FederatedModel, JnnElement, JnnModel } from '../domain/model';
import { createFederatedModel, indexElements } from '../domain/model';
import {
  allBranchIds,
  ancestorIds,
  buildTree,
  defaultExpanded,
  type TreeMode,
  type TreeNode,
} from '../domain/tree';
import { EMPTY_VISIBILITY, hide, isolate, show, toggleGroup, type VisibilityState } from '../domain/visibility';
import { DEFAULT_NAV, type NavigationSettings, type SectionAxis, type SectionSpec, type Vec3 } from '../viewer/ViewerAdapter';

export type Theme = 'light' | 'dark';
export type MobilePane = 'explorer' | 'viewer' | 'properties';

export interface Notice {
  id: number;
  tone: 'info' | 'warning' | 'error';
  text: string;
}

export interface AppState {
  model: JnnModel;
  models: FederatedModel[];
  byId: Map<string, JnnElement>;
  trees: Record<'spatial' | 'category', TreeNode>;
  treeMode: TreeMode;
  expanded: Record<'spatial' | 'category', Set<string>>;
  search: string;
  /** Ordered; last item is the "primary" selection shown in Properties. */
  selection: string[];
  hovered: string | null;
  visibility: VisibilityState;
  section: SectionSpec | null;
  sectionFrameVisible: boolean;
  sectionPickMode: boolean;
  initialSectionBox: { min: Vec3; max: Vec3 } | null;
  lastSectionBox: Record<string, { min: Vec3; max: Vec3 }>;
  lastSectionPlane: Record<string, Extract<SectionSpec, { kind: 'plane' }>>;
  xray: boolean;
  projection: 'perspective' | 'orthographic';
  theme: Theme;
  explorerOpen: boolean;
  propertiesOpen: boolean;
  rightTab: 'properties' | 'clash' | 'rules';
  gridVisible: boolean;
  navigation: NavigationSettings;
  settingsOpen: boolean;
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
  | { type: 'setSectionFrameVisible'; visible: boolean }
  | { type: 'setSectionPickMode'; on: boolean }
  | { type: 'toggleXray' }
  | { type: 'setProjection'; projection: AppState['projection'] }
  | { type: 'setTheme'; theme: Theme }
  | { type: 'togglePanel'; panel: 'explorer' | 'properties'; open?: boolean }
  | { type: 'setRightTab'; tab: 'properties' | 'clash' | 'rules' }
  | { type: 'toggleGrid' }
  | { type: 'setGridVisible'; visible: boolean }
  | { type: 'setNavigation'; settings: Partial<NavigationSettings> }
  | { type: 'resetNavigation' }
  | { type: 'setSettingsOpen'; open: boolean }
  | { type: 'setMobilePane'; pane: MobilePane }
  | { type: 'notify'; tone: Notice['tone']; text: string }
  | { type: 'dismissNotice'; id: number }
  | { type: 'setModel'; model: JnnModel }
  | { type: 'appendModel'; model: JnnModel }
  | { type: 'removeModel'; modelId: string }
  | { type: 'toggleModelVisibility'; modelId: string; visible?: boolean };

let noticeSeq = 1;

function loadSavedNav(): NavigationSettings {
  try {
    const raw = localStorage.getItem('jnn-nav-settings');
    if (raw) return { ...DEFAULT_NAV, ...JSON.parse(raw) };
  } catch {}
  return structuredClone(DEFAULT_NAV);
}

export function createInitialState(model: JnnModel, theme: Theme): AppState {
  const fed: FederatedModel = {
    modelId: model.modelId,
    name: model.name,
    fileName: model.name,
    schema: model.ifcSchema,
    elementCount: model.elements.length,
    visible: true,
    jnnModel: model,
  };
  const models = [fed];
  const trees = { spatial: buildTree(model, 'spatial', models), category: buildTree(model, 'category', models) };
  return {
    model,
    models,
    byId: indexElements(model),
    trees,
    treeMode: 'spatial',
    expanded: { spatial: defaultExpanded(trees.spatial), category: defaultExpanded(trees.category) },
    search: '',
    selection: [],
    hovered: null,
    visibility: EMPTY_VISIBILITY,
    section: null,
    sectionFrameVisible: true,
    sectionPickMode: false,
    initialSectionBox: null,
    lastSectionBox: {},
    lastSectionPlane: {},
    xray: false,
    projection: 'perspective',
    theme,
    explorerOpen: true,
    propertiesOpen: true,
    rightTab: 'properties',
    gridVisible: true,
    navigation: loadSavedNav(),
    settingsOpen: false,
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
      if (state.treeMode === 'models') return state;
      const s = new Set(state.expanded[state.treeMode]);
      if (s.has(action.nodeId)) s.delete(action.nodeId);
      else s.add(action.nodeId);
      return { ...state, expanded: { ...state.expanded, [state.treeMode]: s } };
    }
    case 'expandAll': {
      if (state.treeMode === 'models') return state;
      return { ...state, expanded: { ...state.expanded, [state.treeMode]: new Set(allBranchIds(state.trees[state.treeMode])) } };
    }
    case 'collapseAll': {
      if (state.treeMode === 'models') return state;
      return { ...state, expanded: { ...state.expanded, [state.treeMode]: defaultExpanded(state.trees[state.treeMode]) } };
    }
    case 'setSearch':
      return { ...state, search: action.query };
    case 'setSection': {
      const section = action.section;
      let initialSectionBox = state.initialSectionBox;
      const lastSectionBox = { ...state.lastSectionBox };
      const lastSectionPlane = { ...state.lastSectionPlane };
      const modelKey = state.model.modelId || 'default';

      if (!section) {
        initialSectionBox = null;
      } else if (section.kind === 'box') {
        if (!initialSectionBox || state.section?.kind !== 'box') {
          initialSectionBox = { min: section.min, max: section.max };
        }
        lastSectionBox[modelKey] = { min: section.min, max: section.max };
      } else if (section.kind === 'plane') {
        lastSectionPlane[modelKey] = section;
      }

      return {
        ...state,
        section,
        initialSectionBox,
        lastSectionBox,
        lastSectionPlane,
      };
    }
    case 'setSectionFrameVisible':
      return { ...state, sectionFrameVisible: action.visible };
    case 'setSectionPickMode':
      return { ...state, sectionPickMode: action.on };
    case 'toggleXray':
      return { ...state, xray: !state.xray };
    case 'setProjection':
      return { ...state, projection: action.projection };
    case 'toggleGrid':
      return { ...state, gridVisible: !state.gridVisible };
    case 'setGridVisible':
      return { ...state, gridVisible: action.visible };
    case 'setNavigation': {
      const next = { ...state.navigation, ...action.settings };
      try {
        localStorage.setItem('jnn-nav-settings', JSON.stringify(next));
      } catch {}
      return { ...state, navigation: next };
    }
    case 'resetNavigation': {
      const next = structuredClone(DEFAULT_NAV);
      try {
        localStorage.removeItem('jnn-nav-settings');
      } catch {}
      return { ...state, navigation: next };
    }
    case 'setSettingsOpen':
      return { ...state, settingsOpen: action.open };
    case 'setTheme':
      return { ...state, theme: action.theme };
    case 'togglePanel': {
      const key = action.panel === 'explorer' ? 'explorerOpen' : 'propertiesOpen';
      return { ...state, [key]: action.open ?? !state[key] };
    }
    case 'setRightTab':
      return { ...state, rightTab: action.tab, propertiesOpen: true };
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
        rightTab: state.rightTab,
        mobilePane: state.mobilePane,
        gridVisible: state.gridVisible,
        navigation: state.navigation,
        settingsOpen: state.settingsOpen,
        sectionFrameVisible: state.sectionFrameVisible,
      };
    }
    case 'appendModel': {
      const fed: FederatedModel = {
        modelId: action.model.modelId,
        name: action.model.name,
        fileName: action.model.name,
        schema: action.model.ifcSchema,
        elementCount: action.model.elements.length,
        visible: true,
        jnnModel: action.model,
      };
      const existing = state.models.findIndex((m) => m.modelId === action.model.modelId);
      const nextModels = existing >= 0
        ? state.models.map((m, i) => (i === existing ? fed : m))
        : [...state.models.filter((m) => m.modelId !== 'empty'), fed];
      const combined = createFederatedModel(nextModels);
      const byId = indexElements(combined);
      const trees = {
        spatial: buildTree(combined, 'spatial', nextModels),
        category: buildTree(combined, 'category', nextModels),
      };
      return {
        ...state,
        model: combined,
        models: nextModels,
        byId,
        trees,
        expanded: { spatial: defaultExpanded(trees.spatial), category: defaultExpanded(trees.category) },
      };
    }
    case 'removeModel': {
      const nextModels = state.models.filter((m) => m.modelId !== action.modelId);
      const combined = createFederatedModel(nextModels);
      const byId = indexElements(combined);
      const trees = {
        spatial: buildTree(combined, 'spatial', nextModels),
        category: buildTree(combined, 'category', nextModels),
      };
      return {
        ...state,
        model: combined,
        models: nextModels,
        byId,
        trees,
        selection: state.selection.filter((id) => byId.has(id)),
        expanded: { spatial: defaultExpanded(trees.spatial), category: defaultExpanded(trees.category) },
      };
    }
    case 'toggleModelVisibility': {
      const target = state.models.find((m) => m.modelId === action.modelId);
      if (!target) return state;
      const isNowVisible = action.visible !== undefined ? action.visible : !target.visible;
      const nextModels = state.models.map((m) => (m.modelId === action.modelId ? { ...m, visible: isNowVisible } : m));
      const targetIds = target.jnnModel.elements.map((e) => e.id);
      const visibility = isNowVisible ? show(state.visibility, targetIds) : hide(state.visibility, targetIds);
      return {
        ...state,
        models: nextModels,
        visibility,
        selection: isNowVisible ? state.selection : state.selection.filter((id) => !targetIds.includes(id)),
      };
    }
  }
}

/** Default section plane for an axis: through the middle of the model, or 1.2m above ground storey for Z. */
export function defaultPlane(
  axis: SectionAxis,
  bounds: { min: Vec3; max: Vec3 },
  storeys?: Array<{ elevation: number; name?: string }>
): Extract<SectionSpec, { kind: 'plane' }> {
  const i = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const mid = (bounds.min[i]! + bounds.max[i]!) / 2;

  let offset = mid;
  if (axis === 'z') {
    if (storeys && storeys.length > 0) {
      // Find ground floor / first floor with elevation >= -0.5m, or closest to 0
      const validStoreys = storeys
        .filter((s) => typeof s.elevation === 'number' && !isNaN(s.elevation))
        .sort((a, b) => a.elevation - b.elevation);

      if (validStoreys.length > 0) {
        // Priority 1: Storey named "First Floor", "Ground", "Tầng 1", or elevation in [-0.5m, 1.5m]
        const groundStorey =
          validStoreys.find((s) => {
            const name = (s.name || '').toLowerCase();
            return name.includes('first') || name.includes('ground') || name.includes('tầng 1') || name.includes('level 1');
          }) ??
          validStoreys.find((s) => s.elevation >= -0.5 && s.elevation <= 1.5) ??
          validStoreys.find((s) => s.elevation >= -0.5) ??
          validStoreys[0];

        if (groundStorey) {
          offset = groundStorey.elevation + 1.2;
        }
      }
    } else {
      // Fallback if no storey data: if min Z is underground (footings/piles), use 1.2m, else min[2] + 1.2m
      offset = bounds.min[2] < -0.5 ? 1.2 : bounds.min[2] + 1.2;
    }
  }

  return { kind: 'plane', axis, offset: Math.round(offset * 100) / 100, flipped: false };
}

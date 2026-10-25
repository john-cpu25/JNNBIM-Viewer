import { elementLabel, type JnnElement, type JnnModel } from './model';

export type TreeNodeKind = 'project' | 'site' | 'building' | 'storey' | 'category' | 'type' | 'element';

export interface TreeNode {
  /** Stable, unique within one tree. Element nodes use `el:<elementId>`. */
  id: string;
  label: string;
  kind: TreeNodeKind;
  children: TreeNode[];
  /** All element ids at or below this node, in model order. */
  elementIds: string[];
  elementId?: string;
}

export type TreeMode = 'spatial' | 'category';

export const elementNodeId = (elementId: string) => `el:${elementId}`;

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

const leaf = (e: JnnElement): TreeNode => ({
  id: elementNodeId(e.id),
  label: elementLabel(e),
  kind: 'element',
  children: [],
  elementIds: [e.id],
  elementId: e.id,
});

function branch(id: string, label: string, kind: TreeNodeKind, children: TreeNode[]): TreeNode {
  return { id, label, kind, children, elementIds: children.flatMap((c) => c.elementIds) };
}

/** Project › Site › Building › Storey › Category › Element */
export function buildSpatialTree(model: JnnModel): TreeNode {
  const byStorey = groupBy(model.elements, (e) => e.storey ?? '(Unassigned)');
  const storeyOrder = [...model.storeys.map((s) => s.name), '(Unassigned)'];
  const storeyNodes = storeyOrder
    .filter((name) => byStorey.has(name))
    .map((name, si) => {
      const els = byStorey.get(name)!;
      const cats = [...groupBy(els, (e) => e.category)].sort(([a], [b]) => a.localeCompare(b));
      return branch(
        `storey:${si}:${name}`,
        name,
        'storey',
        cats.map(([cat, ce]) => branch(`storey:${si}:cat:${cat}`, cat, 'category', ce.map(leaf))),
      );
    });
  const building = branch('building', model.buildingName, 'building', storeyNodes);
  const site = branch('site', model.siteName, 'site', [building]);
  return branch('project', model.projectName, 'project', [site]);
}

/** Model › Category › Type › Element */
export function buildCategoryTree(model: JnnModel): TreeNode {
  const cats = [...groupBy(model.elements, (e) => e.category)].sort(([a], [b]) => a.localeCompare(b));
  return branch(
    'project',
    model.name,
    'project',
    cats.map(([cat, els]) => {
      const types = [...groupBy(els, (e) => e.type)].sort(([a], [b]) => a.localeCompare(b));
      return branch(
        `cat:${cat}`,
        cat,
        'category',
        types.map(([type, te]) => branch(`cat:${cat}:type:${type}`, type, 'type', te.map(leaf))),
      );
    }),
  );
}

export function buildTree(model: JnnModel, mode: TreeMode): TreeNode {
  return mode === 'spatial' ? buildSpatialTree(model) : buildCategoryTree(model);
}

/** Text an element can be found by in the explorer search box. */
export function searchText(e: JnnElement): string {
  const mark = e.properties.find((p) => p.name === 'Identity Data')?.properties['Mark'] ?? '';
  return [e.name, e.category, e.type, e.globalId ?? '', e.sourceElementId, String(mark), e.material ?? '', e.storey ?? '']
    .join(' ')
    .toLowerCase();
}

/**
 * Prune the tree to elements matching every whitespace-separated term.
 * Returns null when nothing matches.
 */
export function filterTree(root: TreeNode, query: string, byId: Map<string, JnnElement>): TreeNode | null {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return root;
  const visit = (n: TreeNode): TreeNode | null => {
    if (n.kind === 'element') {
      const el = byId.get(n.elementId!);
      if (!el) return null;
      const t = searchText(el);
      return terms.every((term) => t.includes(term)) ? n : null;
    }
    const kids = n.children.map(visit).filter((c): c is TreeNode => c !== null);
    return kids.length ? branch(n.id, n.label, n.kind, kids) : null;
  };
  return visit(root);
}

export interface FlatRow {
  node: TreeNode;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
}

/** Depth-first list of rows to render, honouring the expanded set. */
export function flattenTree(root: TreeNode, expanded: ReadonlySet<string>, includeRoot = true): FlatRow[] {
  const rows: FlatRow[] = [];
  const walk = (n: TreeNode, depth: number) => {
    const isOpen = expanded.has(n.id);
    rows.push({ node: n, depth, expanded: isOpen, hasChildren: n.children.length > 0 });
    if (isOpen) for (const c of n.children) walk(c, depth + 1);
  };
  if (includeRoot) walk(root, 0);
  else for (const c of root.children) walk(c, 0);
  return rows;
}

/** Ids of all branch nodes on the path to the element (excluding the leaf). */
export function ancestorIds(root: TreeNode, elementId: string): string[] {
  const path: string[] = [];
  const target = elementNodeId(elementId);
  const walk = (n: TreeNode): boolean => {
    if (n.id === target) return true;
    if (n.kind === 'element') return false;
    path.push(n.id);
    for (const c of n.children) if (walk(c)) return true;
    path.pop();
    return false;
  };
  return walk(root) ? path : [];
}

/** Every branch node id — used for "expand all" and when searching. */
export function allBranchIds(root: TreeNode): string[] {
  const ids: string[] = [];
  const walk = (n: TreeNode) => {
    if (n.kind === 'element') return;
    ids.push(n.id);
    n.children.forEach(walk);
  };
  walk(root);
  return ids;
}

/** Default expansion: everything down to storeys / categories. */
export function defaultExpanded(root: TreeNode): Set<string> {
  const ids = new Set<string>();
  const walk = (n: TreeNode) => {
    if (n.kind === 'project' || n.kind === 'site' || n.kind === 'building') {
      ids.add(n.id);
      n.children.forEach(walk);
    }
  };
  walk(root);
  return ids;
}

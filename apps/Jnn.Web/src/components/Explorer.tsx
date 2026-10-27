import { memo, useDeferredValue, useEffect, useMemo, useRef } from 'react';
import {
  Building2,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Crosshair,
  Eye,
  EyeOff,
  Folder,
  FolderPlus,
  Layers,
  MapPin,
  Search,
  Shapes,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import { allBranchIds, elementNodeId, filterTree, flattenTree, type FlatRow, type TreeNode } from '../domain/tree';
import { groupVisibility, type NodeVisibility } from '../domain/visibility';
import { categoryStyle } from '../viewer/categoryStyle';
import { IconButton, Segmented } from './ui';
import { cn } from '../lib/cn';
import { loadIfcFile } from '../lib/ifcLoaderHelper';

const KIND_ICON = { project: Folder, site: MapPin, building: Building2, storey: Layers, type: Shapes } as const;

export function Explorer() {
  const { state, dispatch, viewer } = useApp();
  const tree = state.trees[state.treeMode === 'models' ? 'spatial' : state.treeMode];
  const query = useDeferredValue(state.search);
  const filtered = useMemo(() => filterTree(tree, query, state.byId), [tree, query, state.byId]);
  // While searching, show every match expanded.
  const expanded = useMemo(
    () => (query.trim() && filtered ? new Set(allBranchIds(filtered)) : state.expanded[state.treeMode === 'models' ? 'spatial' : state.treeMode]),
    [query, filtered, state.expanded, state.treeMode],
  );
  const rows = useMemo(() => (filtered ? flattenTree(filtered, expanded, false) : []), [filtered, expanded]);
  const selected = useMemo(() => new Set(state.selection), [state.selection]);
  const primary = state.selection[state.selection.length - 1];
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the primary selection in view when it changes (e.g. picked in 3D).
  useEffect(() => {
    if (!primary || state.treeMode === 'models') return;
    const nodeId = elementNodeId(primary);
    const el = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-node-id]') ?? [])].find((n) => n.dataset.nodeId === nodeId);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [primary, rows, state.treeMode]);

  const matchCount = filtered ? filtered.elementIds.length : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="text-xs font-semibold tracking-wide">Model</h2>
        {state.treeMode !== 'models' && (
          <div className="flex items-center gap-0.5">
            <IconButton icon={ChevronsUpDown} label="Expand all" size="sm" onClick={() => dispatch({ type: 'expandAll' })} />
            <IconButton icon={ChevronsDownUp} label="Collapse" size="sm" onClick={() => dispatch({ type: 'collapseAll' })} />
          </div>
        )}
      </div>
      <div className="space-y-2 border-b border-line px-3 py-2">
        <Segmented
          label="Tree grouping"
          value={state.treeMode}
          onChange={(mode) => dispatch({ type: 'setTreeMode', mode })}
          options={[
            { value: 'spatial', label: 'Spatial', title: 'Site › Building › Storey › Category' },
            { value: 'category', label: 'Categories', title: 'Category › Type' },
            {
              value: 'models',
              label: `Models${state.models.length > 1 ? ` (${state.models.length})` : ''}`,
              title: 'Danh sách các mô hình federated',
            },
          ]}
        />
        {state.treeMode !== 'models' && (
          <>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-faint" aria-hidden />
              <input
                type="search"
                value={state.search}
                onChange={(e) => dispatch({ type: 'setSearch', query: e.target.value })}
                placeholder="Search name, type, GlobalId, mark…"
                aria-label="Search elements"
                className="h-8 w-full rounded-md border border-line bg-surface-2 pr-7 pl-7 text-xs placeholder:text-faint focus:border-accent focus:outline-none"
              />
              {state.search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => dispatch({ type: 'setSearch', query: '' })}
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-faint hover:text-ink"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            {query.trim() && (
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span data-testid="search-count">
                  {matchCount} match{matchCount === 1 ? '' : 'es'}
                </span>
                {matchCount > 0 && (
                  <button
                    type="button"
                    className="font-medium text-accent-ink hover:underline"
                    onClick={() => dispatch({ type: 'select', ids: filtered!.elementIds })}
                  >
                    Select all matches
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {state.treeMode === 'models' ? (
        <ModelsPanel />
      ) : (
        <div ref={listRef} role="tree" aria-label="Model tree" aria-multiselectable className="min-h-0 flex-1 overflow-auto py-1 scroll-thin">
          {rows.length === 0 && <div className="px-3 py-6 text-center text-xs text-faint">No elements match “{query}”.</div>}
          {rows.map((r) => (
            <Row
              key={r.node.id}
              row={r}
              visibility={groupVisibility(r.node.elementIds, state.visibility)}
              selectedState={selectionState(r.node, selected)}
              onToggle={() => dispatch({ type: 'toggleExpanded', nodeId: r.node.id })}
              onSelect={(additive) =>
                dispatch({ type: 'select', ids: r.node.elementIds, mode: additive ? 'toggle' : 'replace' })
              }
              onFit={() => viewer?.fitToView(r.node.elementIds)}
              onToggleVisibility={() => dispatch({ type: 'toggleGroupVisibility', ids: r.node.elementIds })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ModelsPanel() {
  const { state, dispatch, viewer } = useApp();
  const appendInputRef = useRef<HTMLInputElement>(null);

  const onAppendFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadIfcFile(file, viewer, dispatch, { append: true });
      e.target.value = '';
    }
  };

  const handleToggleVisible = (modelId: string, currentVisible: boolean) => {
    dispatch({ type: 'toggleModelVisibility', modelId });
    viewer?.setModelVisibility?.(modelId, !currentVisible);
  };

  const handleRemove = (modelId: string, name: string) => {
    viewer?.removeModel?.(modelId);
    dispatch({ type: 'removeModel', modelId });
    dispatch({ type: 'notify', tone: 'info', text: `Đã gỡ mô hình "${name}".` });
  };

  const handleFit = (modelId: string) => {
    if (viewer?.fitToModel) {
      viewer.fitToModel(modelId);
    } else {
      const target = state.models.find((m) => m.modelId === modelId);
      if (target) {
        viewer?.fitToView(target.jnnModel.elements.map((e) => e.id));
      }
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3 space-y-3" data-testid="models-panel">
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs font-medium text-muted">
          {state.models.length} {state.models.length === 1 ? 'mô hình' : 'mô hình federated'}
        </span>
        <input
          ref={appendInputRef}
          type="file"
          accept=".ifc"
          className="hidden"
          onChange={onAppendFile}
          data-testid="models-panel-append-input"
        />
        <button
          type="button"
          onClick={() => appendInputRef.current?.click()}
          className="flex items-center gap-1 rounded bg-accent-soft px-2 py-1 text-xs font-medium text-accent-ink hover:bg-accent/20"
          data-testid="models-panel-append-btn"
        >
          <FolderPlus size={13} />
          <span>Thêm IFC</span>
        </button>
      </div>

      <div className="space-y-2">
        {state.models.map((m) => (
          <div
            key={m.modelId}
            data-testid={`model-card-${m.modelId}`}
            className={cn(
              'rounded-lg border border-line bg-surface-2 p-2.5 transition-colors',
              !m.visible && 'opacity-60',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-semibold text-ink" title={m.name}>
                    {m.name}
                  </span>
                  {m.schema && (
                    <span className="rounded bg-surface-3 px-1 font-mono text-[10px] text-muted">
                      {m.schema}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-faint">
                  <span>{m.elementCount} cấu kiện</span>
                  <span>•</span>
                  <span>{m.jnnModel.storeys.length} tầng</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title={m.visible ? 'Ẩn toàn bộ model' : 'Hiện model'}
                  onClick={() => handleToggleVisible(m.modelId, m.visible)}
                  className="rounded p-1 text-faint hover:bg-surface-3 hover:text-ink"
                  data-testid={`toggle-visible-model-${m.modelId}`}
                >
                  {m.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-muted" />}
                </button>
                <button
                  type="button"
                  title="Zoom đến model"
                  onClick={() => handleFit(m.modelId)}
                  className="rounded p-1 text-faint hover:bg-surface-3 hover:text-ink"
                  data-testid={`fit-model-${m.modelId}`}
                >
                  <Crosshair size={13} />
                </button>
                {state.models.length > 1 && (
                  <button
                    type="button"
                    title="Gỡ model (giải phóng bộ nhớ)"
                    onClick={() => handleRemove(m.modelId, m.name)}
                    className="rounded p-1 text-faint hover:bg-red-500/10 hover:text-red-500"
                    data-testid={`remove-model-${m.modelId}`}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function selectionState(node: TreeNode, selected: Set<string>): 'none' | 'some' | 'all' {
  if (!selected.size) return 'none';
  let n = 0;
  for (const id of node.elementIds) if (selected.has(id)) n++;
  return n === 0 ? 'none' : n === node.elementIds.length ? 'all' : 'some';
}

interface RowProps {
  row: FlatRow;
  visibility: NodeVisibility;
  selectedState: 'none' | 'some' | 'all';
  onToggle: () => void;
  onSelect: (additive: boolean) => void;
  onFit: () => void;
  onToggleVisibility: () => void;
}

const Row = memo(function Row({ row, visibility, selectedState, onToggle, onSelect, onFit, onToggleVisibility }: RowProps) {
  const { node, depth, expanded, hasChildren } = row;
  const isElement = node.kind === 'element';
  const Icon = node.kind === 'element' || node.kind === 'category' ? null : KIND_ICON[node.kind];
  const swatchCategory = node.kind === 'category' ? node.label : null;
  const isSelected = selectedState === 'all';
  return (
    <div
      role="treeitem"
      aria-label={node.label}
      aria-level={depth + 1}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={isSelected}
      data-node-id={node.id}
      data-testid={isElement ? 'tree-element' : 'tree-group'}
      className={cn(
        'group flex h-7 cursor-default items-center gap-1 pr-1 text-xs select-none',
        isSelected ? 'bg-accent-soft text-ink' : selectedState === 'some' ? 'text-ink' : 'hover:bg-surface-2',
        visibility === 'hidden' && 'text-faint',
      )}
      style={{ paddingLeft: 6 + depth * 14 }}
      onClick={(e) => onSelect(e.ctrlKey || e.metaKey || e.shiftKey)}
      onDoubleClick={onFit}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={expanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-faint hover:bg-surface-3 hover:text-ink"
        >
          <ChevronRight size={13} className={cn('transition-transform', expanded && 'rotate-90')} />
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      {Icon && <Icon size={13} className="shrink-0 text-faint" aria-hidden />}
      {swatchCategory && (
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-black/10"
          style={{ background: categoryStyle(swatchCategory).swatch }}
        />
      )}
      {isElement && selectedState === 'all' && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
      <span className={cn('min-w-0 flex-1 truncate', !isElement && 'font-medium')} title={node.label}>
        {node.label}
      </span>
      {!isElement && <span className="shrink-0 text-[11px] text-faint tabular">{node.elementIds.length}</span>}
      <button
        type="button"
        aria-label={visibility === 'hidden' ? `Show ${node.label}` : `Hide ${node.label}`}
        title={visibility === 'hidden' ? 'Show' : 'Hide'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility();
        }}
        className={cn(
          'grid h-5 w-5 shrink-0 place-items-center rounded text-faint hover:bg-surface-3 hover:text-ink',
          visibility === 'visible' && '[@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          visibility === 'partial' && 'opacity-70',
        )}
      >
        {visibility === 'hidden' ? <EyeOff size={13} /> : <Eye size={13} className={visibility === 'partial' ? 'opacity-60' : ''} />}
      </button>
    </div>
  );
});

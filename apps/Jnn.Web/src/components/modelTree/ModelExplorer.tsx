import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ChevronRight, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  Filter, 
  Folder, 
  FolderOpen, 
  Box, 
  Layers, 
  Building2,
  X,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { BimModel, BimElement, Discipline } from '../../types/bim';

interface ModelExplorerProps {
  model: BimModel;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onToggleVisibility: (elementIds: string[], visible: boolean) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const ModelExplorer: React.FC<ModelExplorerProps> = ({
  model,
  selectedElementId,
  onSelectElement,
  onToggleVisibility,
  collapsed,
  onToggleCollapse
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState<'All' | Discipline>('All');
  const [selectedStorey, setSelectedStorey] = useState<string>('All');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'root': true,
    'disc_Structural': true,
    'storey_Level 02': true
  });
  const [hiddenElements, setHiddenElements] = useState<Set<string>>(new Set());

  // Storey list
  const storeys = useMemo(() => {
    const set = new Set<string>();
    (model?.elements || []).forEach(el => set.add(el.storey));
    return ['All', ...Array.from(set)];
  }, [model]);

  // Filter elements
  const filteredElements = useMemo(() => {
    return (model?.elements || []).filter(el => {
      const matchSearch = searchTerm === '' || 
        el.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        el.mark.toLowerCase().includes(searchTerm.toLowerCase()) ||
        el.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchDiscipline = selectedDiscipline === 'All' || el.discipline === selectedDiscipline;
      const matchStorey = selectedStorey === 'All' || el.storey === selectedStorey;

      return matchSearch && matchDiscipline && matchStorey;
    });
  }, [model, searchTerm, selectedDiscipline, selectedStorey]);

  // Group elements into Discipline -> Storey -> Category
  const treeData = useMemo(() => {
    const tree: Record<string, Record<string, Record<string, BimElement[]>>> = {};

    filteredElements.forEach(el => {
      const disc = el.discipline;
      const storey = el.storey;
      const cat = el.category;

      if (!tree[disc]) tree[disc] = {};
      if (!tree[disc][storey]) tree[disc][storey] = {};
      if (!tree[disc][storey][cat]) tree[disc][storey][cat] = [];

      tree[disc][storey][cat].push(el);
    });

    return tree;
  }, [filteredElements]);

  const toggleNode = (nodeKey: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  };

  const toggleElementVisibility = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextHidden = new Set(hiddenElements);
    const isNowHidden = !nextHidden.has(id);
    if (isNowHidden) {
      nextHidden.add(id);
    } else {
      nextHidden.delete(id);
    }
    setHiddenElements(nextHidden);
    onToggleVisibility([id], !isNowHidden);
  };

  const toggleGroupVisibility = (ids: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    const allHidden = ids.every(id => hiddenElements.has(id));
    const nextHidden = new Set(hiddenElements);
    ids.forEach(id => {
      if (allHidden) {
        nextHidden.delete(id);
      } else {
        nextHidden.add(id);
      }
    });
    setHiddenElements(nextHidden);
    onToggleVisibility(ids, allHidden);
  };

  if (collapsed) {
    return (
      <div className="w-10 border-r border-[var(--border-color)] bg-[var(--bg-surface)] flex flex-col items-center py-3 select-none shrink-0 z-10">
        <button
          onClick={onToggleCollapse}
          data-tooltip="Open Model Explorer"
          className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-cyan-400"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <div className="mt-8 [writing-mode:vertical-rl] rotate-180 text-[11px] font-semibold text-[var(--text-secondary)] tracking-wider uppercase">
          Model Explorer
        </div>
      </div>
    );
  }

  return (
    <aside className="w-72 border-r border-[var(--border-color)] bg-[var(--bg-surface)] flex flex-col h-full select-none shrink-0 z-10">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-[13px] text-[var(--text-primary)]">Model Explorer</span>
          <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-800">
            {filteredElements.length}
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          data-tooltip="Collapse Panel"
          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Instant Search Bar */}
      <div className="p-2 border-b border-[var(--border-color)]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search Mark, Name, GUID..."
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded text-[12px] pl-8 pr-7 py-1 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-cyan-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter Pills: Discipline & Storey */}
        <div className="flex items-center gap-1.5 mt-2">
          <select
            value={selectedDiscipline}
            onChange={e => setSelectedDiscipline(e.target.value as any)}
            className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[11px] rounded px-1.5 py-1 text-[var(--text-secondary)] focus:outline-none focus:border-cyan-500"
          >
            <option value="All">All Disciplines</option>
            <option value="Structural">Structural</option>
            <option value="Mechanical">Mechanical</option>
            <option value="Plumbing">Plumbing</option>
          </select>

          <select
            value={selectedStorey}
            onChange={e => setSelectedStorey(e.target.value)}
            className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[11px] rounded px-1.5 py-1 text-[var(--text-secondary)] focus:outline-none focus:border-cyan-500"
          >
            {storeys.map(st => (
              <option key={st} value={st}>{st === 'All' ? 'All Storeys' : st}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 5-Tier Hierarchical Tree */}
      <div className="flex-1 overflow-y-auto p-2 text-[12px]">
        {Object.keys(treeData).length === 0 ? (
          <div className="p-4 text-center text-[var(--text-muted)] text-[12px]">
            No matching elements found.
          </div>
        ) : (
          Object.entries(treeData).map(([discipline, storeyGroup]) => {
            const discKey = `disc_${discipline}`;
            const isDiscExpanded = expandedNodes[discKey] ?? true;
            const allDiscIds = Object.values(storeyGroup).flatMap(sg => Object.values(sg).flatMap(cg => cg.map(e => e.id)));
            const isDiscAllHidden = allDiscIds.length > 0 && allDiscIds.every(id => hiddenElements.has(id));

            return (
              <div key={discipline} className="mb-1">
                {/* Discipline Node */}
                <div 
                  onClick={() => toggleNode(discKey)}
                  className="flex items-center justify-between p-1 rounded hover:bg-[var(--bg-hover)] cursor-pointer text-cyan-400 font-semibold"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {isDiscExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{discipline}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">{allDiscIds.length}</span>
                    <button
                      onClick={(e) => toggleGroupVisibility(allDiscIds, e)}
                      className="p-0.5 hover:text-white"
                    >
                      {isDiscAllHidden ? <EyeOff className="w-3 h-3 text-rose-400" /> : <Eye className="w-3 h-3 text-[var(--text-muted)]" />}
                    </button>
                  </div>
                </div>

                {/* Storey Nodes */}
                {isDiscExpanded && (
                  <div className="pl-3 border-l border-[var(--border-subtle)] ml-2">
                    {Object.entries(storeyGroup).map(([storey, catGroup]) => {
                      const storeyKey = `storey_${storey}`;
                      const isStoreyExpanded = expandedNodes[storeyKey] ?? true;
                      const allStoreyIds = Object.values(catGroup).flatMap(cg => cg.map(e => e.id));
                      const isStoreyAllHidden = allStoreyIds.every(id => hiddenElements.has(id));

                      return (
                        <div key={storey} className="mt-1">
                          <div 
                            onClick={() => toggleNode(storeyKey)}
                            className="flex items-center justify-between p-1 rounded hover:bg-[var(--bg-hover)] cursor-pointer text-[var(--text-primary)] font-medium"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              {isStoreyExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                              <Folder className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="truncate">{storey}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-[var(--text-muted)] font-mono">{allStoreyIds.length}</span>
                              <button
                                onClick={(e) => toggleGroupVisibility(allStoreyIds, e)}
                                className="p-0.5 hover:text-white"
                              >
                                {isStoreyAllHidden ? <EyeOff className="w-3 h-3 text-rose-400" /> : <Eye className="w-3 h-3 text-[var(--text-muted)]" />}
                              </button>
                            </div>
                          </div>

                          {/* Category Nodes */}
                          {isStoreyExpanded && (
                            <div className="pl-3 border-l border-[var(--border-subtle)] ml-2">
                              {Object.entries(catGroup).map(([category, elements]) => {
                                const catKey = `cat_${discipline}_${storey}_${category}`;
                                const isCatExpanded = expandedNodes[catKey] ?? false;
                                const catIds = elements.map(e => e.id);
                                const isCatAllHidden = catIds.every(id => hiddenElements.has(id));

                                return (
                                  <div key={category} className="mt-0.5">
                                    <div 
                                      onClick={() => toggleNode(catKey)}
                                      className="flex items-center justify-between p-1 rounded hover:bg-[var(--bg-hover)] cursor-pointer text-[var(--text-secondary)]"
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        {isCatExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                                        <Box className="w-3 h-3 text-cyan-400 shrink-0" />
                                        <span className="truncate">{category.replace('Ifc', '')}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] text-[var(--text-muted)] font-mono">{elements.length}</span>
                                        <button
                                          onClick={(e) => toggleGroupVisibility(catIds, e)}
                                          className="p-0.5 hover:text-white"
                                        >
                                          {isCatAllHidden ? <EyeOff className="w-3 h-3 text-rose-400" /> : <Eye className="w-3 h-3 text-[var(--text-muted)]" />}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Leaf Element Nodes */}
                                    {isCatExpanded && (
                                      <div className="pl-3 border-l border-[var(--border-subtle)] ml-2">
                                        {elements.map(el => {
                                          const isSelected = selectedElementId === el.id;
                                          const isElementHidden = hiddenElements.has(el.id);

                                          return (
                                            <div
                                              key={el.id}
                                              onClick={() => onSelectElement(el.id)}
                                              className={`flex items-center justify-between px-1.5 py-1 rounded cursor-pointer transition-colors ${
                                                isSelected 
                                                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold border-l-2 border-cyan-400' 
                                                  : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                                              }`}
                                            >
                                              <span className="truncate font-mono text-[11px]" title={el.name}>
                                                {el.mark || el.name}
                                              </span>
                                              <button
                                                onClick={(e) => toggleElementVisibility(el.id, e)}
                                                className="p-0.5 hover:text-white shrink-0 ml-1"
                                              >
                                                {isElementHidden ? <EyeOff className="w-3 h-3 text-rose-400" /> : <Eye className="w-3 h-3 text-[var(--text-muted)]" />}
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

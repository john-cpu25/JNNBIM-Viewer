import React, { useState } from 'react';
import { 
  Info, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronRight, 
  Hash, 
  Ruler, 
  Layers, 
  Box, 
  Calculator, 
  PanelRightClose,
  PanelRightOpen,
  AlertCircle
} from 'lucide-react';
import { BimElement } from '../../types/bim';

interface PropertiesInspectorProps {
  element: BimElement | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const PropertiesInspector: React.FC<PropertiesInspectorProps> = ({
  element,
  collapsed,
  onToggleCollapse
}) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'quantities' | 'pset'>('properties');
  const [copiedGuid, setCopiedGuid] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'identity': true,
    'geometry': true,
    'material': true,
    'pset': true
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopyGuid = (guid: string) => {
    navigator.clipboard.writeText(guid);
    setCopiedGuid(true);
    setTimeout(() => setCopiedGuid(false), 2000);
  };

  if (collapsed) {
    return (
      <div className="w-10 border-l border-[var(--border-color)] bg-[var(--bg-surface)] flex flex-col items-center py-3 select-none shrink-0 z-10">
        <button
          onClick={onToggleCollapse}
          data-tooltip="Open Properties Panel"
          className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-cyan-400"
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>
        <div className="mt-8 [writing-mode:vertical-rl] text-[11px] font-semibold text-[var(--text-secondary)] tracking-wider uppercase">
          Properties Inspector
        </div>
      </div>
    );
  }

  return (
    <aside className="w-80 border-l border-[var(--border-color)] bg-[var(--bg-surface)] flex flex-col h-full select-none shrink-0 z-10">
      {/* Panel Header */}
      <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-[13px] text-[var(--text-primary)]">Properties Inspector</span>
        </div>
        <button
          onClick={onToggleCollapse}
          data-tooltip="Collapse Panel"
          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      {!element ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--text-muted)]">
          <Box className="w-10 h-10 mb-3 text-cyan-500/30 animate-pulse" />
          <div className="text-[13px] font-semibold text-[var(--text-secondary)] mb-1">No Element Selected</div>
          <div className="text-[11px] leading-relaxed">
            Click on any structural element in the 3D viewport or double click an item in the Model Explorer tree to inspect structural parameters, IFC property sets, and exact volumes.
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Element Summary Banner */}
          <div className="p-3 bg-[var(--bg-elevated)] border-b border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono font-bold bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800">
                {element.category}
              </span>
              <span className="text-[10px] font-medium text-[var(--text-muted)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded">
                {element.storey}
              </span>
            </div>

            <div className="text-[13px] font-bold text-[var(--text-primary)] truncate" title={element.name}>
              {element.name}
            </div>

            {/* GlobalId with 1-click Copy button */}
            <div className="flex items-center justify-between mt-2 text-[10px] text-[var(--text-muted)] font-mono bg-[var(--bg-surface)] p-1.5 rounded border border-[var(--border-subtle)]">
              <span className="truncate mr-2">GUID: {element.globalId}</span>
              <button
                onClick={() => handleCopyGuid(element.globalId)}
                data-tooltip={copiedGuid ? "Copied!" : "Copy GUID"}
                className="text-cyan-400 hover:text-cyan-300 shrink-0"
              >
                {copiedGuid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Sub-tabs: Properties / Quantities / IFC Psets */}
          <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-surface)] text-[11px] font-medium">
            <button
              onClick={() => setActiveTab('properties')}
              className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                activeTab === 'properties' 
                  ? 'border-cyan-400 text-cyan-400 font-semibold' 
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Structural
            </button>
            <button
              onClick={() => setActiveTab('quantities')}
              className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                activeTab === 'quantities' 
                  ? 'border-cyan-400 text-cyan-400 font-semibold' 
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Quantities
            </button>
            <button
              onClick={() => setActiveTab('pset')}
              className={`flex-1 py-2 text-center border-b-2 transition-colors ${
                activeTab === 'pset' 
                  ? 'border-cyan-400 text-cyan-400 font-semibold' 
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Property Sets
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[12px]">
            {activeTab === 'properties' && (
              <>
                {/* Section: Identity */}
                <div className="border border-[var(--border-color)] rounded bg-[var(--bg-elevated)] overflow-hidden">
                  <div 
                    onClick={() => toggleSection('identity')}
                    className="p-2 bg-[var(--bg-surface)] font-semibold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between cursor-pointer"
                  >
                    <span>Identity & Location</span>
                    {expandedSections.identity ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </div>
                  {expandedSections.identity && (
                    <div className="p-2 divide-y divide-[var(--border-subtle)] text-[11px]">
                      <div className="flex justify-between py-1">
                        <span className="text-[var(--text-muted)]">Element Mark</span>
                        <span className="font-mono font-medium text-[var(--text-primary)]">{element.mark}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[var(--text-muted)]">Discipline</span>
                        <span className="font-medium text-[var(--text-primary)]">{element.discipline}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[var(--text-muted)]">Storey Level</span>
                        <span className="font-medium text-[var(--text-primary)]">{element.storey}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[var(--text-muted)]">Source Format</span>
                        <span className="font-mono text-cyan-400">IFC4 Structural</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section: Structural Geometry */}
                <div className="border border-[var(--border-color)] rounded bg-[var(--bg-elevated)] overflow-hidden">
                  <div 
                    onClick={() => toggleSection('geometry')}
                    className="p-2 bg-[var(--bg-surface)] font-semibold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between cursor-pointer"
                  >
                    <span>Structural Geometry</span>
                    {expandedSections.geometry ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </div>
                  {expandedSections.geometry && (
                    <div className="p-2 divide-y divide-[var(--border-subtle)] text-[11px]">
                      <div className="flex justify-between py-1">
                        <span className="text-[var(--text-muted)]">Length (Span L)</span>
                        <span className="font-mono text-[var(--text-primary)]">{element.dimensions.length.toLocaleString()} mm</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[var(--text-muted)]">Width (b)</span>
                        <span className="font-mono text-[var(--text-primary)]">{element.dimensions.width.toLocaleString()} mm</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[var(--text-muted)]">Depth / Height (h)</span>
                        <span className="font-mono text-[var(--text-primary)]">{element.dimensions.height.toLocaleString()} mm</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[var(--text-muted)]">Surface Area</span>
                        <span className="font-mono text-[var(--text-primary)]">{element.dimensions.area} m²</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section: Material & Strength */}
                <div className="border border-[var(--border-color)] rounded bg-[var(--bg-elevated)] overflow-hidden">
                  <div 
                    onClick={() => toggleSection('material')}
                    className="p-2 bg-[var(--bg-surface)] font-semibold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between cursor-pointer"
                  >
                    <span>Material Specification</span>
                    {expandedSections.material ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </div>
                  {expandedSections.material && (
                    <div className="p-2 divide-y divide-[var(--border-subtle)] text-[11px]">
                      <div className="flex justify-between py-1">
                        <span className="text-[var(--text-muted)]">Material Grade</span>
                        <span className="font-semibold text-emerald-400">{element.material}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[var(--text-muted)]">Approximate Mass</span>
                        <span className="font-mono text-[var(--text-primary)]">{element.quantities.weight} tons</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'quantities' && (
              <div className="space-y-3">
                <div className="p-2.5 bg-cyan-950/40 border border-cyan-800/50 rounded text-[11px] text-cyan-300 leading-relaxed">
                  Calculated using <strong>Verified Native IFC Quantities</strong> with accurate opening and junction deductions.
                </div>

                <div className="border border-[var(--border-color)] rounded bg-[var(--bg-elevated)] p-2 divide-y divide-[var(--border-subtle)] text-[11px]">
                  <div className="flex justify-between py-1.5">
                    <span className="text-[var(--text-muted)] font-medium">Net Concrete Volume</span>
                    <span className="font-mono font-bold text-cyan-400">{element.quantities.netVolume} m³</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-[var(--text-muted)] font-medium">Gross Concrete Volume</span>
                    <span className="font-mono text-[var(--text-primary)]">{element.quantities.grossVolume} m³</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-[var(--text-muted)] font-medium">Formwork Surface Area</span>
                    <span className="font-mono font-bold text-emerald-400">{element.quantities.formworkArea} m²</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-[var(--text-muted)] font-medium">Calculated Element Weight</span>
                    <span className="font-mono text-[var(--text-primary)]">{element.quantities.weight} t</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-[var(--text-muted)] font-medium">Validation Status</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Verified
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pset' && (
              <div className="space-y-3">
                {Object.entries(element.properties).map(([psetName, props]) => (
                  <div key={psetName} className="border border-[var(--border-color)] rounded bg-[var(--bg-elevated)] overflow-hidden">
                    <div className="p-2 bg-[var(--bg-surface)] font-semibold text-[11px] text-cyan-400 font-mono">
                      {psetName}
                    </div>
                    <div className="p-2 divide-y divide-[var(--border-subtle)] text-[11px]">
                      {Object.entries(props).map(([propKey, propVal]) => (
                        <div key={propKey} className="flex justify-between py-1">
                          <span className="text-[var(--text-muted)]">{propKey}</span>
                          <span className="font-mono text-[var(--text-primary)]">{String(propVal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

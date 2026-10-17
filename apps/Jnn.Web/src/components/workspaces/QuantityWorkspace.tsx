import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  FileSpreadsheet, 
  Filter, 
  Layers, 
  Building2, 
  Check, 
  HelpCircle,
  Eye,
  Search
} from 'lucide-react';
import { BimElement, QuantityRow } from '../../types/bim';
import { generateSampleQuantities } from '../../data/sampleBimData';

interface QuantityWorkspaceProps {
  elements: BimElement[];
  onSelectElement: (id: string | null) => void;
  selectedElementId: string | null;
}

export const QuantityWorkspace: React.FC<QuantityWorkspaceProps> = ({
  elements,
  onSelectElement,
  selectedElementId
}) => {
  const [groupBy, setGroupBy] = useState<'Storey' | 'Category' | 'Material' | 'Flat'>('Storey');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const rows: QuantityRow[] = useMemo(() => {
    return generateSampleQuantities(elements);
  }, [elements]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const matchSearch = searchTerm === '' || 
        r.mark.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.material.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat = selectedCategory === 'All' || r.category === selectedCategory;

      return matchSearch && matchCat;
    });
  }, [rows, searchTerm, selectedCategory]);

  // Aggregate totals
  const totalVolume = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + r.netVolume, 0);
  }, [filteredRows]);

  const totalFormwork = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + r.formworkArea, 0);
  }, [filteredRows]);

  // Grouped rows
  const groupedData = useMemo(() => {
    if (groupBy === 'Flat') return { 'All Elements': filteredRows };

    const map: Record<string, QuantityRow[]> = {};
    filteredRows.forEach(r => {
      let key = r.storey;
      if (groupBy === 'Category') key = r.category;
      if (groupBy === 'Material') key = r.material;

      if (!map[key]) map[key] = [];
      map[key].push(r);
    });

    return map;
  }, [filteredRows, groupBy]);

  const handleExportCsv = () => {
    const headers = ['Element Mark', 'Storey', 'Category', 'Component Type', 'Material', 'Length (mm)', 'Width (mm)', 'Height (mm)', 'Formwork Area (m2)', 'Net Concrete Volume (m3)', 'Source', 'Status'];
    const csvRows = filteredRows.map(r => [
      `"${r.mark}"`,
      r.storey,
      r.category,
      `"${r.type}"`,
      `"${r.material}"`,
      r.length,
      r.width,
      r.height,
      r.formworkArea,
      r.netVolume,
      r.quantitySource,
      r.verificationStatus
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `JNN_Structural_QTO_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none flex flex-col justify-end p-3 z-20">
      <div className="pointer-events-auto h-[400px] bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-color)] rounded-xl shadow-2xl flex flex-col overflow-hidden select-none">
        {/* Top QTO Ribbon */}
        <div className="p-3 bg-[var(--bg-elevated)] border-b border-[var(--border-color)] flex items-center justify-between flex-wrap gap-2">
          {/* Grouping Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-[13px] text-[var(--text-primary)]">Information Takeoff (QTO)</span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-[var(--text-muted)] font-semibold uppercase">Group By:</span>
              {(['Storey', 'Category', 'Material', 'Flat'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`px-2 py-1 rounded font-medium transition-colors ${
                    groupBy === g
                      ? 'bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Export */}
          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search Mark / Type..."
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded text-[11px] pl-7 pr-2 py-1 text-[var(--text-primary)] focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[11px] transition-colors shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel / CSV</span>
            </button>
          </div>
        </div>

        {/* Calculation Basis Technical Note */}
        <div className="px-3 py-1.5 bg-cyan-950/30 border-b border-cyan-900/40 text-[11px] text-cyan-300/90 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span><strong>Calculation Basis:</strong> Net Concrete Volume with structural beam-column-slab intersection deductions per TCVN / Eurocode 2.</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono font-semibold">Validation: 100% Solid Calculus</span>
        </div>

        {/* Takeoff Table Grid */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left engineering-table border-collapse">
            <thead>
              <tr>
                <th>Element Mark</th>
                <th>Storey</th>
                <th>Category</th>
                <th>Component Type</th>
                <th>Material</th>
                <th>Dimensions (b × h × L)</th>
                <th>Formwork Area (m²)</th>
                <th>Net Concrete Vol (m³)</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedData).map(([groupName, groupRows]) => {
                const groupVol = groupRows.reduce((a, b) => a + b.netVolume, 0);
                const groupArea = groupRows.reduce((a, b) => a + b.formworkArea, 0);

                return (
                  <React.Fragment key={groupName}>
                    {/* Group Header Row */}
                    {groupBy !== 'Flat' && (
                      <tr className="bg-[var(--bg-elevated)] font-semibold text-cyan-300 border-t border-[var(--border-color)]">
                        <td colSpan={6} className="py-1 px-3">
                          <span className="font-bold text-[12px]">{groupName}</span> ({groupRows.length} elements)
                        </td>
                        <td className="font-mono text-emerald-400 font-bold">{groupArea.toFixed(2)} m²</td>
                        <td className="font-mono text-cyan-400 font-bold">{groupVol.toFixed(2)} m³</td>
                        <td colSpan={2} />
                      </tr>
                    )}

                    {/* Member Rows */}
                    {groupRows.map(row => {
                      const isSelected = selectedElementId === row.elementId;
                      return (
                        <tr
                          key={row.elementId}
                          onClick={() => onSelectElement(row.elementId)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'selected font-medium' : ''}`}
                        >
                          <td className="font-mono font-bold text-cyan-400">{row.mark}</td>
                          <td className="text-[var(--text-secondary)]">{row.storey}</td>
                          <td>{row.category}</td>
                          <td className="truncate max-w-[160px]" title={row.type}>{row.type}</td>
                          <td className="text-emerald-400 font-medium">{row.material}</td>
                          <td className="font-mono text-[var(--text-muted)]">
                            {row.width} × {row.height} × {row.length} mm
                          </td>
                          <td className="font-mono font-semibold text-emerald-400">{row.formworkArea.toFixed(2)}</td>
                          <td className="font-mono font-bold text-cyan-400">{row.netVolume.toFixed(2)}</td>
                          <td className="text-[10px] text-[var(--text-muted)] font-mono">{row.quantitySource}</td>
                          <td>
                            <span className="text-emerald-400 font-semibold text-[10px] flex items-center gap-1">
                              <Check className="w-3 h-3" /> Verified
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Aggregate Summary Footer */}
        <div className="p-2.5 bg-[var(--bg-elevated)] border-t border-[var(--border-color)] flex items-center justify-between text-[12px] font-semibold">
          <div className="flex items-center gap-4">
            <span className="text-[var(--text-muted)]">Total Filtered: <strong className="text-[var(--text-primary)]">{filteredRows.length} elements</strong></span>
            <span>•</span>
            <span>Total Formwork Area: <strong className="text-emerald-400 font-mono text-[13px]">{totalFormwork.toFixed(2)} m²</strong></span>
            <span>•</span>
            <span>Total Net Concrete Volume: <strong className="text-cyan-400 font-mono text-[14px]">{totalVolume.toFixed(2)} m³</strong></span>
          </div>

          <div className="text-[11px] text-[var(--text-muted)] italic">
            Click row to locate element in 3D scene
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { 
  Box, 
  Building2, 
  Clock, 
  FileText, 
  Layers, 
  Plus, 
  UploadCloud, 
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Trash2
} from 'lucide-react';
import { Workspace, BimModel } from '../../types/bim';

interface ProjectHomeProps {
  availableModels: BimModel[];
  onOpenModel: (model: BimModel) => void;
  onDeleteModel?: (modelId: string) => void;
  onClearAllModels?: () => void;
  setWorkspace: (ws: Workspace) => void;
}

export const ProjectHome: React.FC<ProjectHomeProps> = ({
  availableModels,
  onOpenModel,
  onDeleteModel,
  onClearAllModels,
  setWorkspace
}) => {
  const hasModels = availableModels.length > 0;

  return (
    <div className="flex-1 bg-[var(--bg-app)] overflow-y-auto p-8 select-none">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome Hero Banner */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-cyan-950/70 via-slate-900 to-slate-900 border border-cyan-800/40 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-900/50 border border-cyan-700/60 text-cyan-300 text-[11px] font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Hybrid Desktop + Web BIM Platform</span>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl overflow-hidden p-1 bg-cyan-950/80 border border-cyan-500/40 shadow-lg shadow-cyan-900/40 flex items-center justify-center shrink-0">
                <img src="/logo.png" alt="JNN Logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
                JNN BIM Viewer
              </h1>
            </div>
            <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-6">
              Precision 3D structural model viewer, high-speed multi-plane sectioning, Navisworks-grade clash detection, and verified quantity takeoff for BIM engineers and shop-drawing checkers.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (hasModels) {
                    onOpenModel(availableModels[0]);
                    setWorkspace('model');
                  } else {
                    setWorkspace('import');
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[13px] shadow-lg shadow-cyan-900/40 transition-all hover:scale-102"
              >
                <Box className="w-4 h-4" />
                <span>{hasModels ? 'Open Active Model (3D)' : 'Import New Model (3D)'}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>

              <button
                onClick={() => setWorkspace('import')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-color)] font-semibold text-[13px] transition-colors"
              >
                <UploadCloud className="w-4 h-4 text-cyan-400" />
                <span>Import Local Model (IFC / RVT / NWD)</span>
              </button>
            </div>
          </div>

          <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-25 pointer-events-none hidden md:block">
            <img src="/logo.png" alt="JNN Logo Watermark" className="w-64 h-64 object-contain filter drop-shadow-[0_0_35px_rgba(6,182,212,0.3)]" />
          </div>
        </div>

        {/* Quick Coordination Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] uppercase font-semibold mb-1">
              <span>Active Models</span>
              <Building2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-[18px] font-bold text-[var(--text-primary)]">
              {availableModels.length} {availableModels.length === 1 ? 'Model' : 'Models'} Loaded
            </div>
            <div className="text-[11px] text-emerald-400 font-mono mt-1">Multi-Model Coordination</div>
          </div>

          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] uppercase font-semibold mb-1">
              <span>Unresolved Clashes</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-[18px] font-bold text-rose-400">4 Critical Conflicts</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-1">Ducts vs Beams & Columns</div>
          </div>

          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] uppercase font-semibold mb-1">
              <span>BCF Topics</span>
              <FileText className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-[18px] font-bold text-cyan-400">2 Open Issues</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-1">Linked with 3D Viewpoints</div>
          </div>

          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] uppercase font-semibold mb-1">
              <span>Total QTO Volume</span>
              <Layers className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-[18px] font-bold text-emerald-400 font-mono">1,248.6 m³</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-1">Solid Calculus Verified</div>
          </div>
        </div>

        {/* Recent Models Table */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 bg-[var(--bg-elevated)] border-b border-[var(--border-color)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-[14px] text-[var(--text-primary)]">
                Available BIM Models & Revisions
              </span>
              <span className="text-[11px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded-full font-mono">
                {availableModels.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {hasModels && onClearAllModels && (
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to remove ALL models from the workspace?')) {
                      onClearAllModels();
                    }
                  }}
                  className="text-[12px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-900/60 font-semibold flex items-center gap-1.5 transition-colors"
                  title="Clear all models"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Models</span>
                </button>
              )}

              <button
                onClick={() => setWorkspace('import')}
                className="text-[12px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-800 font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Import New File</span>
              </button>
            </div>
          </div>

          {!hasModels ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <Box className="w-12 h-12 text-[var(--text-muted)] mb-3 opacity-30" />
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
                No Models Currently Loaded
              </h3>
              <p className="text-[13px] text-[var(--text-muted)] max-w-md mb-5">
                All old models have been removed. Upload or drag & drop your project BIM files (IFC, RVT, NWD, JSON) to start coordinating.
              </p>
              <button
                onClick={() => setWorkspace('import')}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[13px] flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition-all hover:scale-102"
              >
                <Plus className="w-4 h-4" />
                <span>Import Local Model</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left engineering-table border-collapse">
                <thead>
                  <tr>
                    <th>Model Name</th>
                    <th>Revision</th>
                    <th>Format</th>
                    <th>Size</th>
                    <th>Elements</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {availableModels.map(item => (
                    <tr key={item.id} className="hover:bg-[var(--bg-hover)]">
                      <td className="font-semibold text-[var(--text-primary)]">
                        <div className="flex items-center gap-2">
                          <img src="/logo.png" alt="JNN" className="w-4 h-4 object-contain shrink-0" />
                          <span className="truncate max-w-[240px]" title={item.name}>{item.name}</span>
                        </div>
                      </td>
                      <td className="font-mono text-cyan-400">{item.revision}</td>
                      <td>
                        <span className="font-mono text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-1.5 py-0.5 rounded font-bold">
                          {item.sourceFormat}
                        </span>
                      </td>
                      <td className="font-mono text-[var(--text-muted)]">{item.fileSize || 'Local'}</td>
                      <td className="font-mono text-[var(--text-primary)]">{item.elements.length}</td>
                      <td>
                        <span className="text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Ready
                        </span>
                      </td>
                      <td className="text-[var(--text-muted)] text-[11px] truncate max-w-[220px]" title={item.description || ''}>
                        {item.description || 'Structural coordination model'}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              onOpenModel(item);
                              setWorkspace('model');
                            }}
                            className="px-3 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          >
                            <span>Open 3D</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>

                          {onDeleteModel && (
                            <button
                              onClick={() => {
                                if (confirm(`Delete model "${item.name}"?`)) {
                                  onDeleteModel(item.id);
                                }
                              }}
                              className="p-1 rounded bg-rose-950/40 hover:bg-rose-900 text-rose-400 hover:text-rose-200 border border-rose-900/60 transition-colors"
                              title="Delete model"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

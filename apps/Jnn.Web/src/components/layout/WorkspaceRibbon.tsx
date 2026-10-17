import React from 'react';
import { 
  Box, 
  Scissors, 
  AlertTriangle, 
  Calculator, 
  FileText, 
  UploadCloud, 
  Home
} from 'lucide-react';
import { Workspace } from '../../types/bim';

interface WorkspaceRibbonProps {
  currentWorkspace: Workspace;
  setWorkspace: (ws: Workspace) => void;
  unresolvedClashesCount: number;
  openIssuesCount: number;
}

export const WorkspaceRibbon: React.FC<WorkspaceRibbonProps> = ({
  currentWorkspace,
  setWorkspace,
  unresolvedClashesCount,
  openIssuesCount
}) => {
  const tabs = [
    { id: 'model' as Workspace, label: '3D Model', icon: Box },
    { id: 'section' as Workspace, label: 'Section Cuts', icon: Scissors },
    { 
      id: 'clash' as Workspace, 
      label: 'Clash Detection', 
      icon: AlertTriangle, 
      badge: unresolvedClashesCount > 0 ? unresolvedClashesCount : undefined,
      badgeColor: 'bg-rose-500 text-white'
    },
    { id: 'quantity' as Workspace, label: 'Quantity Takeoff (QTO)', icon: Calculator },
    { 
      id: 'reports' as Workspace, 
      label: 'Reports & BCF', 
      icon: FileText,
      badge: openIssuesCount > 0 ? openIssuesCount : undefined,
      badgeColor: 'bg-cyan-500 text-white'
    },
    { id: 'import' as Workspace, label: 'Import / Pipeline', icon: UploadCloud }
  ];

  return (
    <nav className="h-10 bg-[var(--bg-surface)] border-b border-[var(--border-color)] px-3 flex items-center justify-between select-none shrink-0 z-20">
      <div className="flex items-center gap-1">
        {/* Project Home Link */}
        <button
          onClick={() => setWorkspace('home')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] font-medium transition-colors ${
            currentWorkspace === 'home'
              ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/80 font-semibold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Home</span>
        </button>

        <div className="h-4 w-[1px] bg-[var(--border-color)] mx-1" />

        {/* Workspace Action Buttons */}
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentWorkspace === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setWorkspace(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-[12px] font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-950/20 font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-[var(--text-muted)]'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${tab.badgeColor}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Coordination Status Reminder */}
      <div className="hidden md:flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
        <span>Coordinate System: <strong className="text-[var(--text-secondary)] font-mono">Project Base Point</strong></span>
        <span>•</span>
        <span>Units: <strong className="text-[var(--text-secondary)]">mm / m³</strong></span>
      </div>
    </nav>
  );
};

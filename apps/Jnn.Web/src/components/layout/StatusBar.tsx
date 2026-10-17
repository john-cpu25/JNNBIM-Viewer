import React from 'react';
import { Activity, Check, Cpu, Eye, Gauge } from 'lucide-react';
import { BimElement } from '../../types/bim';

interface StatusBarProps {
  totalElementsCount: number;
  visibleElementsCount: number;
  selectedElement: BimElement | null;
  fps: number;
  activeEngine: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  totalElementsCount,
  visibleElementsCount,
  selectedElement,
  fps,
  activeEngine
}) => {
  return (
    <footer className="h-7 border-t border-[var(--border-color)] bg-[var(--bg-surface)] px-3 flex items-center justify-between text-[11px] text-[var(--text-secondary)] select-none shrink-0 z-30">
      {/* Left: Engine & Ready state */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Engine Ready</span>
        </div>

        <div className="h-3 w-[1px] bg-[var(--border-color)]" />

        <div className="flex items-center gap-1 font-mono text-[var(--text-muted)]">
          <Cpu className="w-3 h-3 text-cyan-400" />
          <span>{activeEngine}</span>
        </div>

        <div className="h-3 w-[1px] bg-[var(--border-color)]" />

        <div className="flex items-center gap-1">
          <Eye className="w-3 h-3 text-[var(--text-muted)]" />
          <span>Visible: <strong className="text-[var(--text-primary)]">{visibleElementsCount}</strong> / {totalElementsCount}</span>
        </div>
      </div>

      {/* Center: Selected Element info */}
      <div className="truncate max-w-md hidden sm:block">
        {selectedElement ? (
          <span className="font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
            Selected: <strong className="text-[var(--text-primary)]">{selectedElement.name}</strong> [{selectedElement.storey} | {selectedElement.category}]
          </span>
        ) : (
          <span className="text-[var(--text-muted)] italic">No element selected — Click in viewport to inspect properties</span>
        )}
      </div>

      {/* Right: Metrics & System Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 font-mono">
          <Gauge className="w-3 h-3 text-cyan-400" />
          <span className={fps >= 50 ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
            {fps} FPS
          </span>
        </div>

        <div className="h-3 w-[1px] bg-[var(--border-color)]" />

        <div className="flex items-center gap-1 text-[var(--text-muted)] font-mono">
          <span>Worker:</span>
          <span className="text-emerald-400">IDLE</span>
        </div>

        <div className="h-3 w-[1px] bg-[var(--border-color)]" />

        <span className="text-[var(--text-muted)]">Metric (mm / m³)</span>
      </div>
    </footer>
  );
};

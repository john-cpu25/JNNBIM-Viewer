import React, { useState } from 'react';
import { 
  Scissors, 
  RotateCcw, 
  FlipHorizontal, 
  BoxSelect, 
  Sliders, 
  Eye, 
  Check, 
  Camera,
  Layers
} from 'lucide-react';
import { ViewerAdapter } from '../../adapters/ViewerAdapter';

interface SectionWorkspaceProps {
  adapter: ViewerAdapter;
}

export const SectionWorkspace: React.FC<SectionWorkspaceProps> = ({ adapter }) => {
  const [activeAxis, setActiveAxis] = useState<'x' | 'y' | 'z' | 'box'>('z');
  const [offset, setOffset] = useState<number>(3.6);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isSectionActive, setIsSectionActive] = useState<boolean>(true);

  const applySection = (axis: 'x' | 'y' | 'z', newOffset: number, flipped: boolean, enabled: boolean) => {
    adapter.setSectionPlane(axis, enabled, newOffset, flipped);
  };

  const handleAxisChange = (axis: 'x' | 'y' | 'z' | 'box') => {
    setActiveAxis(axis);
    if (axis === 'box') {
      adapter.setSectionBox(true, [-6, 0, -6], [6, 7.5, 6]);
    } else {
      adapter.setSectionBox(false);
      applySection(axis, offset, isFlipped, isSectionActive);
    }
  };

  const handleOffsetChange = (newVal: number) => {
    setOffset(newVal);
    if (activeAxis !== 'box') {
      applySection(activeAxis, newVal, isFlipped, isSectionActive);
    }
  };

  const handleFlip = () => {
    const nextFlipped = !isFlipped;
    setIsFlipped(nextFlipped);
    if (activeAxis !== 'box') {
      applySection(activeAxis, offset, nextFlipped, isSectionActive);
    }
  };

  const handleReset = () => {
    setIsSectionActive(false);
    adapter.setSectionPlane('z', false, 0, false);
    adapter.setSectionBox(false);
    adapter.showAll();
  };

  const handleApplyPreset = (presetAxis: 'x' | 'y' | 'z', presetOffset: number, presetFlipped: boolean) => {
    setActiveAxis(presetAxis);
    setOffset(presetOffset);
    setIsFlipped(presetFlipped);
    setIsSectionActive(true);
    adapter.setSectionBox(false);
    applySection(presetAxis, presetOffset, presetFlipped, true);
  };

  return (
    <div className="absolute top-4 left-4 z-20 pointer-events-auto w-84 bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden select-none">
      {/* Workspace Header */}
      <div className="p-3 bg-[var(--bg-elevated)] border-b border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-[13px] text-[var(--text-primary)]">Section Cut & Clipping</span>
        </div>
        <button
          onClick={handleReset}
          data-tooltip="Reset All Sections"
          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-rose-400 text-[11px] flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      <div className="p-3 space-y-4 text-[12px]">
        {/* Plane Orientation Selector */}
        <div>
          <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
            Cutting Plane Orientation
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => handleAxisChange('x')}
              className={`py-1.5 rounded font-mono text-[11px] font-bold border transition-colors ${
                activeAxis === 'x'
                  ? 'bg-cyan-950 text-cyan-400 border-cyan-700 shadow-sm'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              X-Plane
            </button>
            <button
              onClick={() => handleAxisChange('y')}
              className={`py-1.5 rounded font-mono text-[11px] font-bold border transition-colors ${
                activeAxis === 'y'
                  ? 'bg-cyan-950 text-cyan-400 border-cyan-700 shadow-sm'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              Y-Plane
            </button>
            <button
              onClick={() => handleAxisChange('z')}
              className={`py-1.5 rounded font-mono text-[11px] font-bold border transition-colors ${
                activeAxis === 'z'
                  ? 'bg-cyan-950 text-cyan-400 border-cyan-700 shadow-sm'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              Z-Floor
            </button>
            <button
              onClick={() => handleAxisChange('box')}
              className={`py-1.5 rounded font-mono text-[11px] font-bold border transition-colors ${
                activeAxis === 'box'
                  ? 'bg-cyan-950 text-cyan-400 border-cyan-700 shadow-sm'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              3D Box
            </button>
          </div>
        </div>

        {/* Plane Offset Slider & Flip Button */}
        {activeAxis !== 'box' && (
          <div className="space-y-2 bg-[var(--bg-elevated)] p-2.5 rounded border border-[var(--border-color)]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--text-muted)] font-medium">Plane Elevation / Offset:</span>
              <span className="font-mono font-bold text-cyan-400">
                {(offset * 1000).toFixed(0)} mm ({offset.toFixed(2)} m)
              </span>
            </div>

            <input
              type="range"
              min={-2}
              max={15}
              step={0.1}
              value={offset}
              onChange={(e) => handleOffsetChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleFlip}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                  isFlipped 
                    ? 'bg-amber-950/80 text-amber-400 border-amber-800' 
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span>Flip Normal ({isFlipped ? 'Inverted' : 'Standard'})</span>
              </button>

              <button
                onClick={() => {
                  if (activeAxis === 'z') adapter.setCameraPreset('Top');
                  if (activeAxis === 'x') adapter.setCameraPreset('Right');
                  if (activeAxis === 'y') adapter.setCameraPreset('Front');
                  adapter.setCameraProjection('Orthographic');
                }}
                data-tooltip="Align Ortho Camera to Cut"
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Align Ortho</span>
              </button>
            </div>
          </div>
        )}

        {/* Saved Section Presets */}
        <div>
          <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
            Engineering Section Presets
          </label>
          <div className="space-y-1.5">
            <button
              onClick={() => handleApplyPreset('z', 3.6, false)}
              className="w-full flex items-center justify-between p-2 rounded bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-left text-[11px]"
            >
              <div>
                <div className="font-semibold text-[var(--text-primary)]">Level 02 Typical Soffit Cut</div>
                <div className="text-[10px] text-[var(--text-muted)]">Z = +3,600 mm (Inspection of beam/slab soffits)</div>
              </div>
              <Scissors className="w-3.5 h-3.5 text-cyan-400" />
            </button>

            <button
              onClick={() => handleApplyPreset('x', 0, false)}
              className="w-full flex items-center justify-between p-2 rounded bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-left text-[11px]"
            >
              <div>
                <div className="font-semibold text-[var(--text-primary)]">Central Core Shear Wall Cut</div>
                <div className="text-[10px] text-[var(--text-muted)]">X = 0.00 mm (Elevator shaft vertical section)</div>
              </div>
              <Scissors className="w-3.5 h-3.5 text-cyan-400" />
            </button>

            <button
              onClick={() => handleApplyPreset('z', 0.2, false)}
              className="w-full flex items-center justify-between p-2 rounded bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-left text-[11px]"
            >
              <div>
                <div className="font-semibold text-[var(--text-primary)]">Ground Foundation Mat Cut</div>
                <div className="text-[10px] text-[var(--text-muted)]">Z = +200 mm (Pad footings & tie-beams)</div>
              </div>
              <Scissors className="w-3.5 h-3.5 text-cyan-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

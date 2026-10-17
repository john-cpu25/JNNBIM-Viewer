import React, { useState } from 'react';
import { 
  Settings, 
  Sun, 
  Moon, 
  Palette, 
  MousePointer, 
  Database, 
  Trash2, 
  Check, 
  X
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkTheme: boolean;
  toggleTheme: () => void;
  viewportBg: string;
  setViewportBg: (bg: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isDarkTheme,
  toggleTheme,
  viewportBg,
  setViewportBg
}) => {
  const [navPreset, setNavPreset] = useState<'revit' | 'navisworks' | 'blender'>('revit');
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric');
  const [cacheCleared, setCacheCleared] = useState(false);

  if (!isOpen) return null;

  const bgOptions = [
    { id: '#0f172a', label: 'Dark Slate (Default)' },
    { id: '#0c1e33', label: 'Blueprint Navy' },
    { id: '#e2e8f0', label: 'Architectural Fog' },
    { id: '#ffffff', label: 'Pure White' },
  ];

  const handleClearCache = () => {
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-[var(--bg-elevated)] border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-[14px] text-[var(--text-primary)]">Viewer Preferences & Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-[12px]">
          {/* UI Theme */}
          <div>
            <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-2">
              Application Theme
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { if (!isDarkTheme) toggleTheme(); }}
                className={`p-3 rounded-lg border flex items-center gap-2.5 transition-colors ${
                  isDarkTheme 
                    ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 font-semibold' 
                    : 'bg-[var(--bg-elevated)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <Moon className="w-4 h-4 text-cyan-400" />
                <div className="text-left">
                  <div>Dark Theme</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Slate #0b0f19 engineering</div>
                </div>
              </button>

              <button
                onClick={() => { if (isDarkTheme) toggleTheme(); }}
                className={`p-3 rounded-lg border flex items-center gap-2.5 transition-colors ${
                  !isDarkTheme 
                    ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 font-semibold' 
                    : 'bg-[var(--bg-elevated)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-400" />
                <div className="text-left">
                  <div>Light Theme</div>
                  <div className="text-[10px] text-[var(--text-muted)]">High contrast architectural</div>
                </div>
              </button>
            </div>
          </div>

          {/* 3D Viewport Background Tint */}
          <div>
            <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-2">
              3D Viewport Background Color
            </label>
            <div className="grid grid-cols-2 gap-2">
              {bgOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setViewportBg(opt.id)}
                  className={`p-2.5 rounded-lg border flex items-center gap-2 transition-colors ${
                    viewportBg === opt.id 
                      ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 font-semibold' 
                      : 'border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div 
                    className="w-4 h-4 rounded-full border border-gray-600 shrink-0 shadow-sm" 
                    style={{ backgroundColor: opt.id }} 
                  />
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Orbit Navigation Style */}
          <div>
            <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
              Mouse Navigation Controls Preset
            </label>
            <select
              value={navPreset}
              onChange={(e) => setNavPreset(e.target.value as any)}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded p-2 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-cyan-500"
            >
              <option value="revit">Revit Standard (Shift + Middle Click to Orbit, Right Click for Pan)</option>
              <option value="navisworks">Navisworks Standard (Left Click Orbit, Middle Click Pan)</option>
              <option value="blender">Blender Standard (Middle Click Orbit, Shift + Middle Click Pan)</option>
            </select>
          </div>

          {/* Local Geometry Cache */}
          <div className="p-3 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="font-semibold text-[12px] text-[var(--text-primary)]">Local Geometry Cache (.jgc)</div>
                <div className="text-[10px] text-[var(--text-muted)]">Currently caching 48.5 MB across 2 revisions</div>
              </div>
            </div>
            <button
              onClick={handleClearCache}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--bg-surface)] hover:bg-rose-950 text-rose-400 border border-[var(--border-color)] text-[11px] font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{cacheCleared ? 'Cache Cleared!' : 'Purge Cache'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[var(--bg-elevated)] border-t border-[var(--border-color)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[12px] transition-colors"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};

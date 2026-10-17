import React, { useState } from 'react';
import { 
  Box, 
  Layers, 
  Sun, 
  Moon, 
  Settings, 
  RotateCcw, 
  RotateCw, 
  CheckCircle2, 
  Palette,
  ChevronDown,
  UploadCloud,
  Check,
  Trash2
} from 'lucide-react';
import { Workspace, BimModel } from '../../types/bim';

interface AppHeaderProps {
  currentWorkspace: Workspace;
  setWorkspace: (ws: Workspace) => void;
  isDarkTheme: boolean;
  toggleTheme: () => void;
  viewportBg: string;
  setViewportBg: (bg: string) => void;
  onOpenSettings: () => void;
  currentModel: BimModel;
  availableModels: BimModel[];
  onSelectModel: (model: BimModel) => void;
  onDeleteModel?: (modelId: string) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentWorkspace,
  setWorkspace,
  isDarkTheme,
  toggleTheme,
  viewportBg,
  setViewportBg,
  onOpenSettings,
  currentModel,
  availableModels,
  onSelectModel,
  onDeleteModel
}) => {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const bgPresets = [
    { id: '#0f172a', label: 'Dark Slate' },
    { id: '#0c1e33', label: 'Blueprint' },
    { id: '#e2e8f0', label: 'Light Gray' },
    { id: '#ffffff', label: 'Pure White' },
  ];

  return (
    <header className="h-12 border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-3 flex items-center justify-between select-none z-30 shrink-0">
      {/* Brand & Project Info */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setWorkspace('home')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-lg overflow-hidden p-0.5 bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center shadow-md shadow-cyan-950/40">
            <img src="/logo.png" alt="JNN Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-[14px] tracking-tight bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">
            JNN BIM VIEWER
          </span>
        </button>

        <div className="h-4 w-[1px] bg-[var(--border-color)] mx-1" />

        {/* Project Selector */}
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-[var(--text-muted)] font-medium">Project:</span>
          <span 
            onClick={() => setIsModelDropdownOpen(prev => !prev)}
            className="font-semibold text-[var(--text-primary)] hover:text-cyan-400 cursor-pointer flex items-center gap-1"
          >
            {currentModel?.name ? currentModel.name.split(' — ')[0] : 'No Project'}
            {currentModel?.revision && (
              <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800/60 px-1.5 py-0.5 rounded font-mono">
                {currentModel.revision}
              </span>
            )}
          </span>
        </div>

        {/* Live Sync Status */}
        <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded">
          <CheckCircle2 className="w-3 h-3" />
          <span>Synced</span>
        </div>
      </div>

      {/* Center: Interactive Model Switcher Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsModelDropdownOpen(prev => !prev)}
          className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)] font-mono bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] px-3 py-1.5 rounded-lg border border-[var(--border-color)] transition-colors shadow-sm"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-[var(--text-primary)] font-semibold truncate max-w-[280px]">
            {currentModel?.name || 'No Model Loaded'}
          </span>
          {currentModel?.sourceFormat && (
            <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800">
              {currentModel.sourceFormat}
            </span>
          )}
          <span className="text-[11px] text-[var(--text-muted)]">
            {currentModel?.elements?.length || 0} elements
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-cyan-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isModelDropdownOpen && (
          <div className="absolute left-0 top-full mt-1.5 w-96 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl p-2 z-50 divide-y divide-[var(--border-subtle)]">
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2 py-1 mb-1">
              Switch BIM Model
            </div>

            <div className="py-1 space-y-1">
              {availableModels.length === 0 ? (
                <div className="p-3 text-center text-[12px] text-[var(--text-muted)]">
                  No models loaded.
                </div>
              ) : (
                availableModels.map(m => {
                  const isSelected = currentModel?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors group/item ${
                        isSelected 
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-semibold' 
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <button
                        onClick={() => {
                          onSelectModel(m);
                          setIsModelDropdownOpen(false);
                          setWorkspace('model');
                        }}
                        className="flex-1 text-left truncate mr-2"
                      >
                        <div className="text-[12px] font-bold text-[var(--text-primary)] truncate">
                          {m.name}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {m.revision} • {m.elements.length} elements • {m.fileSize || 'Local'}
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800 px-1 rounded">
                          {m.sourceFormat}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                        {onDeleteModel && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete model "${m.name}"?`)) {
                                onDeleteModel(m.id);
                              }
                            }}
                            title="Delete model"
                            className="p-1 rounded hover:bg-rose-950/80 text-rose-400 hover:text-rose-200 transition-colors opacity-70 group-hover/item:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 mt-1">
              <button
                onClick={() => {
                  setIsModelDropdownOpen(false);
                  setWorkspace('import');
                }}
                className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[12px] flex items-center justify-center gap-1.5 shadow-md shadow-cyan-900/30 transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                <span>+ Import New Model (IFC / RVT / NWD)...</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5">
        <button 
          data-tooltip="Undo (Ctrl+Z)"
          className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button 
          data-tooltip="Redo (Ctrl+Y)"
          className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <RotateCw className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-[var(--border-color)] mx-1" />

        {/* Viewport Canvas Background Selector */}
        <div className="relative group">
          <button 
            data-tooltip="Canvas Background"
            className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-cyan-400 flex items-center gap-1 text-[11px]"
          >
            <Palette className="w-4 h-4" />
          </button>
          <div className="absolute right-0 top-full mt-1 w-36 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded shadow-xl p-1.5 hidden group-hover:block z-50">
            <div className="text-[10px] font-semibold text-[var(--text-muted)] px-1 mb-1 uppercase tracking-wider">
              Canvas Tint
            </div>
            {bgPresets.map(preset => (
              <button
                key={preset.id}
                onClick={() => setViewportBg(preset.id)}
                className={`w-full flex items-center gap-2 px-2 py-1 text-[11px] rounded text-left transition-colors ${
                  viewportBg === preset.id ? 'bg-cyan-950 text-cyan-400 font-semibold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <div 
                  className="w-3.5 h-3.5 rounded-full border border-gray-600 shrink-0" 
                  style={{ backgroundColor: preset.id }} 
                />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Theme Toggle Button */}
        <button 
          onClick={toggleTheme}
          data-tooltip={isDarkTheme ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-amber-400"
        >
          {isDarkTheme ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Settings Button */}
        <button 
          onClick={onOpenSettings}
          data-tooltip="Viewer Preferences"
          className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <Settings className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-[var(--border-color)] mx-1" />

        {/* User Profile */}
        <div className="flex items-center gap-2 pl-1 cursor-pointer">
          <div className="w-6 h-6 rounded-full bg-cyan-700 text-white font-bold text-[11px] flex items-center justify-center border border-cyan-500/50">
            NN
          </div>
        </div>
      </div>
    </header>
  );
};

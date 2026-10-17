import React, { useEffect, useRef, useState } from 'react';
import { 
  MousePointer, 
  RotateCw, 
  Move, 
  Maximize2, 
  Eye, 
  EyeOff, 
  Layers, 
  Ghost, 
  Sun,
  Scissors, 
  Camera, 
  Ruler, 
  CheckSquare,
  Sparkles
} from 'lucide-react';
import { ViewerAdapter } from '../../adapters/ViewerAdapter';
import { BimModel, CameraPreset, BimElement } from '../../types/bim';
import { ViewCube } from './ViewCube';

interface ThreeViewportProps {
  adapter: ViewerAdapter;
  model: BimModel;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  viewportBg: string;
}

export const ThreeViewport: React.FC<ThreeViewportProps> = ({
  adapter,
  model,
  selectedElementId,
  onSelectElement,
  viewportBg
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'orbit' | 'pan'>('select');
  const [isOrtho, setIsOrtho] = useState(false);
  const [isGhost, setIsGhost] = useState(false);
  const [isShadows, setIsShadows] = useState<boolean>(() => adapter.isShadowsEnabled ? adapter.isShadowsEnabled() : false);
  const [isAnnotations, setIsAnnotations] = useState<boolean>(true);
  const [hoveredElement, setHoveredElement] = useState<BimElement | null>(null);
  const [screenshotNotification, setScreenshotNotification] = useState<string | null>(null);

  // 1. Initialize Viewer on Mount (only once)
  useEffect(() => {
    if (!containerRef.current) return;

    adapter.init(containerRef.current);

    adapter.onElementSelected(id => {
      onSelectElement(id);
    });

    return () => {
      adapter.dispose();
    };
  }, [adapter]);

  // 2. Load / Reload Model whenever `model` changes
  useEffect(() => {
    adapter.loadModel(model);

    adapter.onElementHovered(id => {
      if (id) {
        const found = model.elements.find(e => e.id === id);
        setHoveredElement(found || null);
      } else {
        setHoveredElement(null);
      }
    });
  }, [adapter, model]);

  // Update Viewport Background
  useEffect(() => {
    adapter.setBackgroundColor(viewportBg);
  }, [adapter, viewportBg]);

  // Sync external selection with adapter
  useEffect(() => {
    adapter.selectElement(selectedElementId);
  }, [adapter, selectedElementId]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'f' || e.key === 'F') {
        adapter.fitToView(selectedElementId ? [selectedElementId] : undefined);
      } else if (e.key === 'i' || e.key === 'I') {
        if (selectedElementId) adapter.isolateElements([selectedElementId]);
      } else if (e.key === 'h' || e.key === 'H') {
        if (selectedElementId) adapter.hideElements([selectedElementId]);
      } else if (e.key === 'a' || e.key === 'A') {
        adapter.showAll();
      } else if (e.key === 'g' || e.key === 'G') {
        toggleGhost();
      } else if (e.key === 's' || e.key === 'S') {
        toggleShadows();
      } else if (e.key === 'l' || e.key === 'L') {
        toggleAnnotations();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [adapter, selectedElementId, isGhost, isShadows, isAnnotations]);

  const toggleProjection = () => {
    const nextOrtho = !isOrtho;
    setIsOrtho(nextOrtho);
    adapter.setCameraProjection(nextOrtho ? 'Orthographic' : 'Perspective');
  };

  const toggleGhost = () => {
    const nextGhost = !isGhost;
    setIsGhost(nextGhost);
    adapter.setGhostMode(nextGhost);
  };

  const toggleShadows = () => {
    setIsShadows(prev => {
      const next = !prev;
      adapter.setShadows?.(next);
      return next;
    });
  };

  const toggleAnnotations = () => {
    setIsAnnotations(prev => {
      const next = !prev;
      adapter.setAnnotationsVisibility?.(next);
      return next;
    });
  };

  const handleTakeScreenshot = () => {
    const dataUrl = adapter.captureScreenshot();
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `JNN_Viewpoint_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      setScreenshotNotification('Snapshot saved to Downloads');
      setTimeout(() => setScreenshotNotification(null), 3000);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none" style={{ backgroundColor: viewportBg }}>
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 3D Interactive ViewCube Top-Right */}
      <ViewCube 
        adapter={adapter}
        onSelectPreset={(preset) => adapter.setCameraPreset(preset)} 
      />

      {/* Floating Hover Badge */}
      {hoveredElement && (
        <div className="absolute top-4 left-4 z-20 pointer-events-none bg-[var(--bg-surface)]/90 backdrop-blur-md border border-cyan-500/40 shadow-xl rounded px-3 py-1.5 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <div>
            <div className="text-[12px] font-bold text-[var(--text-primary)]">
              {hoveredElement.name}
            </div>
            <div className="text-[10px] text-cyan-400 font-mono">
              {hoveredElement.category} • {hoveredElement.storey}
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Toast Notification */}
      {screenshotNotification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-emerald-950/90 border border-emerald-600 text-emerald-300 text-[12px] px-4 py-2 rounded-lg shadow-2xl flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{screenshotNotification}</span>
        </div>
      )}

      {/* Floating Bottom Engineering Toolbar */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <div className="bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border-color)] rounded-xl shadow-2xl px-2 py-1.5 flex items-center gap-1">
          {/* Navigation Controls Group */}
          <button
            onClick={() => setActiveTool('select')}
            data-tooltip="Select Element"
            className={`p-2 rounded-lg transition-colors ${
              activeTool === 'select' 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' 
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <MousePointer className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('orbit')}
            data-tooltip="Orbit (Left Click & Drag)"
            className={`p-2 rounded-lg transition-colors ${
              activeTool === 'orbit' 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' 
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('pan')}
            data-tooltip="Pan (Right Click & Drag)"
            className={`p-2 rounded-lg transition-colors ${
              activeTool === 'pan' 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' 
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Move className="w-4 h-4" />
          </button>

          <button
            onClick={() => adapter.fitToView(selectedElementId ? [selectedElementId] : undefined)}
            data-tooltip="Fit to View (F)"
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-cyan-400 hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <div className="h-5 w-[1px] bg-[var(--border-color)] mx-1" />

          {/* Visibility Tools Group */}
          <button
            onClick={() => {
              if (selectedElementId) adapter.isolateElements([selectedElementId]);
            }}
            disabled={!selectedElementId}
            data-tooltip="Isolate Selection (I)"
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-cyan-400 hover:bg-[var(--bg-hover)] disabled:opacity-40 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (selectedElementId) adapter.hideElements([selectedElementId]);
            }}
            disabled={!selectedElementId}
            data-tooltip="Hide Selection (H)"
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-rose-400 hover:bg-[var(--bg-hover)] disabled:opacity-40 transition-colors"
          >
            <EyeOff className="w-4 h-4" />
          </button>

          <button
            onClick={() => adapter.showAll()}
            data-tooltip="Show All Elements (A)"
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-emerald-400 hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Layers className="w-4 h-4" />
          </button>

          <button
            onClick={toggleGhost}
            data-tooltip={isGhost ? "Exit X-Ray Mode (G)" : "Ghost / X-Ray Mode (G)"}
            className={`p-2 rounded-lg transition-colors ${
              isGhost 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' 
                : 'text-[var(--text-secondary)] hover:text-amber-400 hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Ghost className="w-4 h-4" />
          </button>

          <button
            onClick={toggleShadows}
            data-tooltip={isShadows ? "Turn Off Cast Shadows (S)" : "Turn On Cast Shadows (S)"}
            className={`p-2 rounded-lg transition-colors ${
              isShadows 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm' 
                : 'text-[var(--text-secondary)] hover:text-amber-400 hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Sun className="w-4 h-4" />
          </button>

          <button
            onClick={toggleAnnotations}
            data-tooltip={isAnnotations ? "Hide Levels, Grids & Scope Box (L)" : "Show Levels, Grids & Scope Box (L)"}
            className={`p-2 rounded-lg transition-colors ${
              isAnnotations 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm' 
                : 'text-[var(--text-secondary)] hover:text-cyan-400 hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Ruler className="w-4 h-4" />
          </button>

          <div className="h-5 w-[1px] bg-[var(--border-color)] mx-1" />

          {/* Camera Projection Toggle */}
          <button
            onClick={toggleProjection}
            data-tooltip={isOrtho ? "Switch to Perspective (P)" : "Switch to Orthographic (O)"}
            className={`px-2 py-1 text-[11px] font-mono font-bold rounded-lg transition-colors ${
              isOrtho 
                ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' 
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {isOrtho ? 'ORTHO' : 'PERSP'}
          </button>

          {/* Capture Screenshot */}
          <button
            onClick={handleTakeScreenshot}
            data-tooltip="Save Viewpoint Snapshot (PNG)"
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-cyan-400 hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

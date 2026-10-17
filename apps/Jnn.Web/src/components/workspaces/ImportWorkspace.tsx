import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileCode, 
  CheckCircle2, 
  ArrowRight, 
  Terminal, 
  Cpu, 
  Sparkles,
  Layers,
  FolderOpen,
  Check
} from 'lucide-react';
import { Workspace, BimModel } from '../../types/bim';
import { initialAvailableModels, createModelFromUploadedFile } from '../../data/sampleBimData';

interface ImportWorkspaceProps {
  onModelLoaded: (newModel: BimModel) => void;
  setWorkspace: (ws: Workspace) => void;
}

export const ImportWorkspace: React.FC<ImportWorkspaceProps> = ({
  onModelLoaded,
  setWorkspace
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContentText, setFileContentText] = useState<string>('');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStage, setProgressStage] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([
    '[INFO] Ingestion Pipeline ready. Select a local file or choose a benchmark model below.'
  ]);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [preparedModel, setPreparedModel] = useState<BimModel | null>(initialAvailableModels[0]);

  const stages = [
    'Stage 1: Ingesting file headers and verifying checksum...',
    'Stage 2: Parsing spatial containment (Storeys, Building, Site)...',
    'Stage 3: Extracting IFC Property Sets (Psets) and Native Quantities...',
    'Stage 4: Tessellating triangular B-rep meshes & building BVH spatial index...',
    'Stage 5: Generating JNN Binary Geometry Cache (.jgc) — Model Ready!'
  ];

  // Handle file selection from local disk
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    setSelectedFile(file);
    setSelectedPresetIndex(-1);
    setProgressStage(0);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string || '';
      setFileContentText(text);
      const parsed = createModelFromUploadedFile(file, text);
      setPreparedModel(parsed);
      setLogs([
        `[INFO] Loaded local file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`,
        `[INFO] Format detected: ${parsed.sourceFormat}`,
        `[INFO] Extracted ${parsed.elements.length} structural elements. Ready to run conversion pipeline.`
      ]);
    };

    // If file is smaller than 25MB, read as text to parse IFC headers/entities
    if (file.size < 25 * 1024 * 1024) {
      reader.readAsText(file);
    } else {
      const parsed = createModelFromUploadedFile(file);
      setPreparedModel(parsed);
      setLogs([
        `[INFO] Loaded large local file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`,
        `[INFO] Stream chunking allocated. Ready to run conversion pipeline.`
      ]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleSelectPreset = (idx: number) => {
    setSelectedPresetIndex(idx);
    setSelectedFile(null);
    setProgressStage(0);
    const model = initialAvailableModels[idx];
    setPreparedModel(model);
    setLogs([
      `[INFO] Selected Benchmark Model: ${model.name}`,
      `[INFO] Revision: ${model.revision} | Format: ${model.sourceFormat} | Elements: ${model.elements.length}`
    ]);
  };

  const handleStartImport = () => {
    if (!preparedModel) return;

    setIsProcessing(true);
    setProgressStage(0);
    setLogs(prev => [...prev, '[INFO] Starting JNN Conversion Pipeline...']);

    let current = 0;
    const interval = setInterval(() => {
      current++;
      setProgressStage(current);
      setLogs(prev => [
        ...prev, 
        `[${new Date().toLocaleTimeString()}] ${stages[current - 1]}`
      ]);

      if (current >= 5) {
        clearInterval(interval);
        setIsProcessing(false);
        setLogs(prev => [
          ...prev, 
          `[SUCCESS] Model '${preparedModel.name}' successfully parsed and cached! ${preparedModel.elements.length} elements ready.`
        ]);
      }
    }, 450);
  };

  const handleOpenInViewport = () => {
    if (preparedModel) {
      onModelLoaded(preparedModel);
      setWorkspace('model');
    }
  };

  const activeFormat = preparedModel?.sourceFormat || 'IFC4';
  const activeFileName = selectedFile ? selectedFile.name : (preparedModel?.name || 'Metropole_Structural_Coordination.ifc');
  const activeSize = selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB` : (preparedModel?.fileSize || '48.5 MB');

  return (
    <div className="absolute inset-0 z-30 bg-[var(--bg-app)]/90 backdrop-blur-lg flex items-center justify-center p-6 select-none overflow-y-auto">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".ifc,.rvt,.nwd,.nwc,.json"
        className="hidden"
      />

      <div className="w-full max-w-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Modal Header */}
        <div className="p-4 bg-[var(--bg-elevated)] border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-[14px] text-[var(--text-primary)]">Model Ingestion & Conversion Pipeline</div>
              <div className="text-[11px] text-[var(--text-muted)]">Upload your local IFC, Revit, or Navisworks model, or choose a benchmark project</div>
            </div>
          </div>
          <button
            onClick={() => setWorkspace('model')}
            className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded hover:bg-[var(--bg-hover)]"
          >
            ✕ Close
          </button>
        </div>

        {/* Wizard Body */}
        <div className="p-6 space-y-5 text-[12px]">
          {/* File Selector & Drag-and-drop zone */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragOver 
                ? 'border-cyan-400 bg-cyan-950/40 scale-[1.01]' 
                : 'border-cyan-600/40 hover:border-cyan-500 bg-cyan-950/10'
            }`}
          >
            <FileCode className="w-10 h-10 text-cyan-400 mx-auto mb-2 animate-bounce-slow" />
            <div className="font-bold text-[14px] text-[var(--text-primary)] mb-1">
              {selectedFile ? `Selected: ${selectedFile.name}` : 'Click to Browse File or Drag & Drop Here'}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mb-3">
              Supported Formats: <strong>.ifc (IFC2x3 / IFC4)</strong>, <strong>.rvt (Revit 2024-2027)</strong>, <strong>.nwc / .nwd (Navisworks)</strong>, <strong>.json</strong>
            </div>

            <div className="inline-flex items-center gap-2 bg-[var(--bg-surface)] px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[11px] font-mono text-cyan-400 font-semibold shadow-sm">
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>{activeFileName} ({activeSize})</span>
            </div>
          </div>

          {/* Quick Benchmark Preset Selection */}
          <div>
            <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Or Select a Predefined Benchmark BIM Model:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {initialAvailableModels.map((m, idx) => {
                const isSelected = selectedPresetIndex === idx && !selectedFile;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelectPreset(idx)}
                    className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col justify-between ${
                      isSelected 
                        ? 'border-cyan-500 bg-cyan-950/50 text-cyan-300 shadow-sm' 
                        : 'border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1 rounded font-bold">
                        {m.sourceFormat}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <div className="font-bold text-[12px] text-[var(--text-primary)] line-clamp-1 mb-1">
                      {m.name.split(' — ')[0]}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      {m.elements.length} elements • {m.revision}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Adapter Detection & Target Engine Route */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg">
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">Detected Format</div>
              <div className="font-semibold text-cyan-400 text-[13px] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{activeFormat === 'IFC4' ? 'Industry Foundation Classes (IFC4)' : activeFormat === 'RVT2025' ? 'Autodesk Revit (RVT 2025)' : 'Navisworks (NWD)'}</span>
              </div>
            </div>

            <div className="p-3 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg">
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">Target Engine Route</div>
              <div className="font-semibold text-emerald-400 text-[13px] flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span>{activeFormat === 'IFC4' ? 'Client WebAssembly (web-ifc Fragments)' : 'JNN Bridge / Geometry Ingestion Core'}</span>
              </div>
            </div>
          </div>

          {/* Progress Tracker Bar */}
          {isProcessing || progressStage > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[var(--text-secondary)]">Conversion Pipeline Progress:</span>
                <span className="font-mono font-bold text-cyan-400">
                  {Math.min(100, progressStage * 20)}%
                </span>
              </div>
              <div className="h-2 w-full bg-[var(--bg-elevated)] rounded-full overflow-hidden border border-[var(--border-color)]">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, progressStage * 20)}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Terminal / Ingestion Diagnostics Log */}
          <div className="bg-[#050811] border border-[var(--border-color)] rounded-lg p-3 font-mono text-[11px] h-28 overflow-y-auto text-slate-300">
            <div className="flex items-center gap-1.5 text-cyan-400 mb-2 border-b border-slate-800 pb-1">
              <Terminal className="w-3.5 h-3.5" />
              <span className="font-bold">INGESTION DIAGNOSTICS LOG</span>
            </div>
            {logs.map((log, idx) => (
              <div key={idx} className="leading-relaxed">{log}</div>
            ))}
          </div>
        </div>

        {/* Wizard Footer Actions */}
        <div className="p-4 bg-[var(--bg-elevated)] border-t border-[var(--border-color)] flex items-center justify-between">
          <button
            onClick={() => setWorkspace('model')}
            className="px-4 py-1.5 rounded text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStartImport}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[12px] shadow-md shadow-cyan-900/30 disabled:opacity-50 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isProcessing ? 'Processing Model...' : 'Run Ingestion Pipeline'}</span>
            </button>

            {progressStage >= 5 && (
              <button
                onClick={handleOpenInViewport}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[12px] shadow-md shadow-emerald-900/30 transition-all animate-pulse"
              >
                <span>Open in 3D Viewport</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import { useRef, useState } from 'react';
import { FolderOpen, FolderPlus, Moon, PanelLeft, PanelRight, Settings, Sparkles, Sun } from 'lucide-react';
import { useApp } from '../state/AppContext';
import type { Layout } from '../lib/useLayout';
import { IconButton } from './ui';
import { loadIfcFile } from '../lib/ifcLoaderHelper';
import { SettingsModal } from './SettingsModal';

export function TopBar({ layout }: { layout: Layout }) {
  const { state, dispatch, viewer } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendFileInputRef = useRef<HTMLInputElement>(null);
  const m = state.model;
  const narrow = layout === 'narrow';

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, append = false) => {
    const file = e.target.files?.[0];
    if (file) {
      loadIfcFile(file, viewer, dispatch, { append });
      e.target.value = '';
    }
  };

  const onLoadSample = () => {
    const url = new URL('./samples/building-arch-2x3.ifc', window.location.href).href;
    loadIfcFile(url, viewer, dispatch, { append: false });
  };

  const onAppendSampleStruct = () => {
    const url = new URL('./samples/building-struct-2x3.ifc', window.location.href).href;
    loadIfcFile(url, viewer, dispatch, { append: true });
  };

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 sm:px-3">
      {!narrow && (
        <IconButton
          icon={PanelLeft}
          label="Toggle model explorer"
          active={state.explorerOpen}
          onClick={() => dispatch({ type: 'togglePanel', panel: 'explorer' })}
        />
      )}
      <div className="flex items-center gap-2 pr-1">
        <Logo />
        <span className="text-[13px] font-semibold tracking-tight">JNN</span>
      </div>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
        <span className="hidden truncate md:inline">{m.projectName}</span>
        <span className="hidden text-faint md:inline">/</span>
        <span className="truncate font-medium text-ink">{m.name}</span>
        {state.models.length > 1 && (
          <span className="rounded bg-accent/20 px-1.5 font-mono text-[10.5px] font-medium text-accent-ink" data-testid="models-count-badge">
            {state.models.length} models
          </span>
        )}
        {m.modelRevisionId && (
          <span className="hidden rounded border border-line px-1.5 font-mono text-[10.5px] sm:inline">{m.modelRevisionId}</span>
        )}
        <span
          className="rounded bg-accent-soft px-1.5 font-mono text-[10.5px] font-medium text-accent-ink"
          title={m.sourceFormat === 'SAMPLE' ? 'Procedural sample data — not loaded from a model file' : 'Industry Foundation Classes (IFC)'}
        >
          {m.sourceFormat}
        </span>
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".ifc"
          className="hidden"
          onChange={(e) => onFileChange(e, false)}
          data-testid="ifc-file-input"
        />
        <input
          ref={appendFileInputRef}
          type="file"
          accept=".ifc"
          className="hidden"
          onChange={(e) => onFileChange(e, true)}
          data-testid="append-ifc-input"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Mở file IFC mới (thay thế cảnh hiện tại)"
          data-testid="open-ifc-btn"
          className="flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          <FolderOpen size={13} className="text-accent" />
          <span className="hidden sm:inline">Mở IFC</span>
        </button>
        <button
          type="button"
          onClick={() => appendFileInputRef.current?.click()}
          title="Thêm mô hình IFC vào cảnh hiện tại (Append federated)"
          data-testid="append-ifc-btn"
          className="flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          <FolderPlus size={13} className="text-emerald-500" />
          <span className="hidden sm:inline">Thêm model</span>
        </button>
        <button
          type="button"
          onClick={onLoadSample}
          title="Mở mô hình IFC mẫu kiến trúc (Building-Architecture) — Bản quyền buildingSMART Simple-Scene (CC BY 4.0)"
          data-testid="open-sample-btn"
          className="flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-ink"
        >
          <Sparkles size={13} className="text-accent-ink" />
          <span className="hidden md:inline">Mẫu KT</span>
        </button>
        <button
          type="button"
          onClick={onAppendSampleStruct}
          title="Thêm mô hình IFC mẫu kết cấu (Building-Structure federated) — Bản quyền buildingSMART Simple-Scene (CC BY 4.0)"
          data-testid="append-sample-struct-btn"
          className="flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs font-medium text-emerald-600 transition-colors hover:border-accent hover:text-emerald-500"
        >
          <Sparkles size={13} className="text-emerald-500" />
          <span className="hidden lg:inline">+ Mẫu KC</span>
        </button>

        <IconButton
          icon={Settings}
          label="Cài đặt & Quản lý Cache"
          onClick={() => setSettingsOpen(true)}
          data-testid="settings-btn"
        />
        <IconButton
          icon={state.theme === 'dark' ? Sun : Moon}
          label={state.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => dispatch({ type: 'setTheme', theme: state.theme === 'dark' ? 'light' : 'dark' })}
          data-testid="theme-toggle"
        />
        {!narrow && (
          <IconButton
            icon={PanelRight}
            label="Toggle properties"
            active={state.propertiesOpen}
            onClick={() => dispatch({ type: 'togglePanel', panel: 'properties' })}
          />
        )}
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}

function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden>
      <path d="M8 22V12l8-4 8 4v10l-8 4z" fill="none" stroke="var(--jnn-accent)" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M8 12l8 4 8-4M16 16v10" fill="none" stroke="var(--jnn-accent)" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

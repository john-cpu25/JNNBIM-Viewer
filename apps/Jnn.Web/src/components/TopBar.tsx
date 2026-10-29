import { useRef } from 'react';
import { FolderOpen, FolderPlus, Moon, PanelLeft, PanelRight, Settings, Sun } from 'lucide-react';
import { useApp } from '../state/AppContext';
import type { Layout } from '../lib/useLayout';
import { IconButton } from './ui';
import { loadIfcFile } from '../lib/ifcLoaderHelper';
import { SettingsModal } from './SettingsModal';
import { useTranslation } from '../i18n';

const debugEnabled = () =>
  typeof window !== 'undefined' &&
  (import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug'));

export function TopBar({ layout }: { layout: Layout }) {
  const { state, dispatch, viewer } = useApp();
  const { t, locale, setLocale } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendFileInputRef = useRef<HTMLInputElement>(null);
  const m = state.model;
  const narrow = layout === 'narrow';

  const onLoadSample = () => {
    const url = new URL('./samples/building-arch-2x3.ifc', window.location.href).href;
    loadIfcFile(url, viewer, dispatch, { append: false });
  };

  const onAppendSampleStruct = () => {
    const url = new URL('./samples/building-struct-2x3.ifc', window.location.href).href;
    loadIfcFile(url, viewer, dispatch, { append: true });
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, append = false) => {
    const file = e.target.files?.[0];
    if (file) {
      loadIfcFile(file, viewer, dispatch, { append });
      e.target.value = '';
    }
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
          title={t('topbar.openIfc')}
          data-testid="open-ifc-btn"
          className="flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          <FolderOpen size={13} className="text-accent" />
          <span className="hidden sm:inline">{t('topbar.openIfc')}</span>
        </button>
        <button
          type="button"
          onClick={() => appendFileInputRef.current?.click()}
          title={t('topbar.appendModel')}
          data-testid="append-ifc-btn"
          className="flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          <FolderPlus size={13} className="text-emerald-500" />
          <span className="hidden sm:inline">{t('topbar.appendModel')}</span>
        </button>

        {debugEnabled() && (
          <>
            <button
              type="button"
              onClick={onLoadSample}
              title="Mở mô hình IFC mẫu kiến trúc (debug)"
              data-testid="open-sample-btn"
              className="flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs font-medium text-accent transition-colors hover:border-accent hover:text-ink"
            >
              <span className="hidden md:inline">Mẫu KT</span>
            </button>
            <button
              type="button"
              onClick={onAppendSampleStruct}
              title="Thêm mô hình IFC mẫu kết cấu (debug)"
              data-testid="append-sample-struct-btn"
              className="flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs font-medium text-emerald-600 transition-colors hover:border-accent hover:text-emerald-500"
            >
              <span className="hidden lg:inline">+ Mẫu KC</span>
            </button>
          </>
        )}

        <IconButton
          icon={Settings}
          label={t('topbar.settings')}
          onClick={() => dispatch({ type: 'setSettingsOpen', open: true })}
          data-testid="settings-btn"
        />
        <button
          type="button"
          onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
          title={locale === 'vi' ? 'Switch to English' : 'Chuyển sang tiếng Việt'}
          aria-label={t('topbar.language')}
          data-testid="language-toggle"
          className="flex h-7 items-center justify-center rounded-md border border-line bg-surface-2 px-2 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
        >
          {locale.toUpperCase()}
        </button>
        <IconButton
          icon={state.theme === 'dark' ? Sun : Moon}
          label={t('topbar.theme')}
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
      <SettingsModal open={state.settingsOpen} onClose={() => dispatch({ type: 'setSettingsOpen', open: false })} />
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

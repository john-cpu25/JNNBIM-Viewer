import { useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkPlus,
  Camera,
  Check,
  Download,
  Eye,
  Layers,
  Pencil,
  Scissors,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import { useTranslation } from '../i18n';
import {
  downloadSavedViewsJson,
  importSavedViewsJson,
  MAX_SAVED_VIEWS,
  type SavedView,
} from '../lib/savedViews';
import { IconButton } from './ui';

export function SavedViewsPanel() {
  const { state, dispatch, viewer } = useApp();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveCurrent = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const camRes = viewer?.getCamera();
      const camera = camRes && camRes.ok
        ? camRes.value
        : {
            position: [20, 20, 20] as [number, number, number],
            target: [0, 0, 0] as [number, number, number],
            projection: state.projection,
          };

      let thumbnail = '';
      try {
        if (viewer?.captureScreenshot) {
          const thumb = await viewer.captureScreenshot({
            maxWidth: 160,
            maxHeight: 100,
            mimeType: 'image/jpeg',
            quality: 0.7,
          });
          if (thumb) thumbnail = thumb;
        }
      } catch (e) {
        console.warn('Could not generate thumbnail for view:', e);
      }

      const nextNum = state.savedViews.length + 1;
      const defaultName = `${t('savedViews.defaultName')} ${nextNum}`;

      const newView: SavedView = {
        id: `view-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: defaultName,
        camera,
        section: state.section ? JSON.parse(JSON.stringify(state.section)) : null,
        visibility: {
          hidden: Array.from(state.visibility.hidden),
          isolated: Array.from(state.visibility.isolated),
        },
        xray: state.xray,
        thumbnail,
        createdAt: Date.now(),
      };

      dispatch({ type: 'addSavedView', view: newView });
      dispatch({ type: 'notify', tone: 'info', text: t('savedViews.saved', { name: newView.name }) });
    } finally {
      setSaving(false);
    }
  };

  const handleApply = (v: SavedView) => {
    if (viewer) {
      viewer.setCamera(v.camera, true);
      viewer.setSection(v.section);
      if (v.visibility.isolated.length > 0) {
        viewer.isolate(v.visibility.isolated);
      } else if (v.visibility.hidden.length > 0) {
        viewer.setHidden(v.visibility.hidden);
      } else {
        viewer.isolate([]);
        viewer.setHidden([]);
      }
      viewer.setXray(v.xray);
    }
    dispatch({ type: 'applySavedView', view: v });
    dispatch({ type: 'notify', tone: 'info', text: t('savedViews.restored', { name: v.name }) });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'deleteSavedView', id });
    dispatch({ type: 'notify', tone: 'info', text: t('savedViews.deleted') });
  };

  const startRename = (v: SavedView, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(v.id);
    setEditingName(v.name);
  };

  const submitRename = (id: string) => {
    const trimmed = editingName.trim();
    if (trimmed) {
      dispatch({ type: 'renameSavedView', id, name: trimmed });
    }
    setEditingId(null);
  };

  const handleExport = () => {
    const filename = `JNN_views_${state.model.name || 'model'}.json`;
    downloadSavedViewsJson(state.savedViews, filename);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        const imported = importSavedViewsJson(text);
        if (imported.length > 0) {
          const merged = [...imported, ...state.savedViews.filter((v) => !imported.some((imp) => imp.id === v.id))].slice(
            0,
            MAX_SAVED_VIEWS,
          );
          dispatch({ type: 'setSavedViews', views: merged });
          dispatch({
            type: 'notify',
            tone: 'info',
            text: `Đã nhập ${imported.length} góc nhìn.`,
          });
        }
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col" data-testid="saved-views-panel">
      {/* Top action bar */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2 bg-surface">
        <button
          type="button"
          data-testid="save-view-btn"
          disabled={saving}
          onClick={handleSaveCurrent}
          className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <BookmarkPlus size={13} />
          <span>{saving ? '...' : t('savedViews.saveCurrent')}</span>
        </button>

        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
            data-testid="import-views-input"
          />
          <IconButton
            icon={Upload}
            label={t('savedViews.import')}
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            data-testid="import-views-btn"
          />
          <IconButton
            icon={Download}
            label={t('savedViews.export')}
            size="sm"
            disabled={state.savedViews.length === 0}
            onClick={handleExport}
            data-testid="export-views-btn"
          />
        </div>
      </div>

      {/* Views List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scroll-thin" data-testid="saved-views-list">
        {state.savedViews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted">
            <Bookmark size={32} className="mb-2 stroke-1 text-faint" />
            <p className="text-xs font-medium text-ink">{t('savedViews.empty')}</p>
            <p className="mt-1 max-w-[220px] text-[11px] text-faint">{t('savedViews.emptyHint')}</p>
          </div>
        ) : (
          state.savedViews.map((v) => {
            const isEditing = editingId === v.id;
            return (
              <div
                key={v.id}
                data-testid="saved-view-card"
                onClick={() => handleApply(v)}
                className="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-line bg-surface-2 transition-all hover:border-accent hover:shadow-sm"
              >
                {/* Thumbnail Header */}
                <div className="relative h-28 w-full bg-surface-3">
                  {v.thumbnail ? (
                    <img
                      src={v.thumbnail}
                      alt={v.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-faint">
                      <Camera size={24} />
                    </div>
                  )}

                  {/* Badges Overlay */}
                  <div className="absolute bottom-1.5 left-1.5 flex flex-wrap gap-1">
                    {v.section && (
                      <span className="flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[9.5px] font-medium text-white backdrop-blur">
                        <Scissors size={10} />
                        {t('savedViews.hasSection')}
                      </span>
                    )}
                    {(v.visibility.hidden.length > 0 || v.visibility.isolated.length > 0) && (
                      <span className="flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[9.5px] font-medium text-white backdrop-blur">
                        <Eye size={10} />
                        {t('savedViews.hasVisibility')}
                      </span>
                    )}
                    {v.xray && (
                      <span className="flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[9.5px] font-medium text-white backdrop-blur">
                        <Layers size={10} />
                        {t('savedViews.hasXray')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="flex items-center justify-between p-2">
                  <div className="min-w-0 flex-1 pr-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          data-testid="view-name-input"
                          value={editingName}
                          autoFocus
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitRename(v.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="w-full rounded border border-accent bg-surface px-1.5 py-0.5 text-xs text-ink focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => submitRename(v.id)}
                          className="rounded p-1 text-accent hover:bg-surface-3"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded p-1 text-muted hover:bg-surface-3"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className="truncate text-xs font-semibold text-ink group-hover:text-accent">
                          {v.name}
                        </span>
                        <span className="text-[10px] text-muted">
                          {new Date(v.createdAt).toLocaleDateString()} {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                      <IconButton
                        icon={Pencil}
                        label={t('savedViews.rename')}
                        size="sm"
                        onClick={(e) => startRename(v, e)}
                        data-testid="rename-view-btn"
                      />
                      <IconButton
                        icon={Trash2}
                        label={t('savedViews.delete')}
                        size="sm"
                        onClick={(e) => handleDelete(v.id, e)}
                        data-testid="delete-view-btn"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

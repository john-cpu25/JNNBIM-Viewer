import { Download, Eye, EyeOff, Ruler, Trash2, X } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { IconButton, Segmented } from './ui';
import { useTranslation } from '../i18n';
import { downloadMeasurementsCsv, formatMeasure } from '../lib/measure';
import type { MeasureTool, MeasureUnit } from '../viewer/ViewerAdapter';

export function MeasurePanel({ compact = false }: { compact?: boolean }) {
  const { state, dispatch, viewer } = useApp();
  const { t } = useTranslation();

  const currentTool = state.measureTool ?? 'length';
  const settings = state.measureSettings;

  const handleToolChange = (tool: string) => {
    dispatch({ type: 'setMeasureTool', tool: tool as MeasureTool });
  };

  const handleUnitChange = (unit: string) => {
    dispatch({
      type: 'setMeasureSettings',
      settings: { unit: unit as MeasureUnit },
    });
  };

  const handlePrecisionChange = (precStr: string) => {
    dispatch({
      type: 'setMeasureSettings',
      settings: { precision: Number(precStr) as 0 | 1 | 2 | 3 },
    });
  };

  const handleSnapToggle = (key: 'vertex' | 'edge' | 'face') => {
    dispatch({
      type: 'setMeasureSettings',
      settings: {
        snap: {
          ...settings.snap,
          [key]: !settings.snap[key],
        },
      },
    });
  };

  const handleClearAll = () => {
    dispatch({ type: 'clearMeasurements' });
    viewer?.clearMeasurements?.();
  };

  const handleDelete = (id: string) => {
    dispatch({ type: 'deleteMeasurement', id });
    viewer?.deleteMeasurement?.(id);
  };

  const handleExportCsv = () => {
    if (state.measurements.length === 0) return;
    downloadMeasurementsCsv(state.measurements);
  };

  const handleToggleVisible = () => {
    dispatch({ type: 'toggleMeasurementsVisible' });
    viewer?.setMeasurementsVisible?.(!state.measurementsVisible);
  };

  const handleClose = () => {
    dispatch({ type: 'setMeasurePanelOpen', open: false });
  };

  const toolLabels: Record<MeasureTool, string> = {
    length: t('measure.toolDistance'),
    edge: t('measure.toolEdge'),
    angle: t('measure.toolAngle'),
    area: t('measure.toolArea'),
    volume: t('measure.toolVolume'),
  };

  return (
    <div
      data-testid="measure-panel"
      className={`absolute left-2 z-20 w-[min(340px,calc(100%-16px))] ${
        compact ? 'top-[66px]' : 'top-2'
      } rounded-lg border border-line bg-surface/95 p-3 shadow-float backdrop-blur space-y-3`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Ruler size={15} className="text-accent" />
          <span>{t('measure.title')}</span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            icon={state.measurementsVisible ? Eye : EyeOff}
            label={state.measurementsVisible ? t('measure.hideAll') : t('measure.showAll')}
            active={state.measurementsVisible}
            size="sm"
            onClick={handleToggleVisible}
            data-testid="measure-toggle-visible"
          />
          <IconButton
            icon={Download}
            label={t('measure.exportCsv')}
            disabled={state.measurements.length === 0}
            size="sm"
            onClick={handleExportCsv}
            data-testid="measure-export-csv-btn"
          />
          <IconButton
            icon={Trash2}
            label={t('measure.clearAll')}
            disabled={state.measurements.length === 0}
            size="sm"
            onClick={handleClearAll}
            data-testid="measure-clear-btn"
          />
          <IconButton icon={X} label="Close" size="sm" onClick={handleClose} data-testid="measure-close-btn" />
        </div>
      </div>

      {/* Tools segmented control */}
      <div className="space-y-1">
        <Segmented<MeasureTool>
          label="Measurement Tool"
          options={[
            { value: 'length', label: t('measure.toolDistance') },
            { value: 'edge', label: t('measure.toolEdge') },
            { value: 'angle', label: t('measure.toolAngle') },
            { value: 'area', label: t('measure.toolArea') },
            { value: 'volume', label: t('measure.toolVolume') },
          ]}
          value={currentTool}
          onChange={handleToolChange}
        />
      </div>

      {/* Unit & Precision */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">{t('measure.unit')}</label>
          <Segmented<MeasureUnit>
            label="Measurement Unit"
            options={[
              { value: 'mm', label: 'mm' },
              { value: 'cm', label: 'cm' },
              { value: 'm', label: 'm' },
            ]}
            value={settings.unit}
            onChange={handleUnitChange}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">{t('measure.precision')}</label>
          <Segmented
            label="Measurement Precision"
            options={[
              { value: '0', label: '0' },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
            ]}
            value={String(settings.precision)}
            onChange={handlePrecisionChange}
          />
        </div>
      </div>

      {/* Snapping checkboxes */}
      <div className="space-y-1.5 border-t border-line/60 pt-2 text-xs">
        <span className="text-[11px] font-medium text-muted">{t('measure.snapping')}</span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-ink text-[11px]">
            <input
              type="checkbox"
              checked={settings.snap.vertex}
              onChange={() => handleSnapToggle('vertex')}
              className="rounded border-line text-accent focus:ring-accent"
              data-testid="snap-vertex"
            />
            <span>{t('measure.snapVertex')}</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-ink text-[11px]">
            <input
              type="checkbox"
              checked={settings.snap.edge}
              onChange={() => handleSnapToggle('edge')}
              className="rounded border-line text-accent focus:ring-accent"
              data-testid="snap-edge"
            />
            <span>{t('measure.snapEdge')}</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-ink text-[11px]">
            <input
              type="checkbox"
              checked={settings.snap.face}
              onChange={() => handleSnapToggle('face')}
              className="rounded border-line text-accent focus:ring-accent"
              data-testid="snap-face"
            />
            <span>{t('measure.snapFace')}</span>
          </label>
        </div>
      </div>

      {/* Measurements list */}
      <div className="space-y-1.5 border-t border-line/60 pt-2 text-xs" data-testid="measure-list">
        <div className="flex items-center justify-between text-[11px] font-medium text-muted">
          <span>Danh sách đo ({state.measurements.length})</span>
        </div>
        {state.measurements.length === 0 ? (
          <div className="py-3 text-center text-[11px] text-muted italic">
            {t('measure.noMeasurements')}
          </div>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
            {state.measurements.map((item, idx) => (
              <div
                key={item.id}
                data-testid="measure-item"
                className="flex items-center justify-between rounded border border-line bg-surface-2 px-2 py-1.5 transition hover:border-accent/40"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-semibold text-accent">
                      #{idx + 1} {toolLabels[item.tool] || item.tool}
                    </span>
                    <span className="text-xs font-bold text-ink tabular">
                      {formatMeasure(item.value, item.unit, settings.precision)}
                    </span>
                  </div>
                  {item.points.length > 0 && (
                    <span className="text-[10px] text-muted truncate">
                      {item.points.length} {t('measure.pointsCount')}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  aria-label={t('measure.delete')}
                  className="rounded p-1 text-faint transition hover:bg-surface-3 hover:text-red-500"
                  data-testid={`delete-measure-${item.id}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

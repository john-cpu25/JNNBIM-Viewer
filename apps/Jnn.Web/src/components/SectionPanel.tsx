import { ArrowLeftRight, Crosshair, Eye, EyeOff, X } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { defaultPlane } from '../state/store';
import { boundsOf, isEmpty, pad } from '../domain/bounds';
import type { Bounds, SectionAxis, SectionSpec, Vec3 } from '../viewer/ViewerAdapter';
import { IconButton, Segmented } from './ui';
import { useEffect, useMemo, useState } from 'react';
import { boxForStorey } from '../viewer/sectionMath';
import { RangePair } from './RangePair';
import { useTranslation } from '../i18n';

const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const;
const AXIS_COLORS: Record<'x' | 'y' | 'z', string> = {
  x: 'text-red-500 font-bold',
  y: 'text-emerald-500 font-bold',
  z: 'text-sky-500 font-bold',
};

export function SectionPanel({ compact = false }: { compact?: boolean }) {
  const { state, dispatch, viewer } = useApp();
  const { t } = useTranslation();
  const s = state.section!;

  // Fallback priority: viewer.getModelBounds() -> selection bounds -> storeys -> +/-25m
  const bounds = useMemo(() => {
    const vb = viewer?.getModelBounds?.();
    if (vb && vb.ok && !isEmpty(vb.value)) {
      return vb.value;
    }
    const b = boundsOf(state.selection.length ? state.selection.map((id) => state.byId.get(id)!).filter(Boolean) : state.model.elements);
    if (!isEmpty(b)) return b;
    if (state.model.storeys.length > 0) {
      const elevs = state.model.storeys.map((st) => st.elevation);
      const minZ = Math.min(...elevs);
      const maxZ = Math.max(...elevs) + 4.0;
      return { min: [-25, -25, minZ] as Vec3, max: [25, 25, maxZ] as Vec3 };
    }
    return { min: [-25, -25, -1] as Vec3, max: [25, 25, 20] as Vec3 };
  }, [viewer, state.selection, state.byId, state.model]);

  const close = () => dispatch({ type: 'setSection', section: null });
  const toggleFrame = () => dispatch({ type: 'setSectionFrameVisible', visible: !state.sectionFrameVisible });

  return (
    <div
      data-testid="section-panel"
      className={`absolute left-2 z-20 w-[min(340px,calc(100%-16px))] ${
        compact ? 'top-[66px]' : 'top-2'
      } rounded-lg border border-line bg-surface/95 p-3 shadow-float backdrop-blur space-y-3`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold">{s.kind === 'plane' ? t('section.planeTitle') : t('section.boxTitle')}</div>
        <div className="flex items-center gap-1">
          <IconButton
            icon={state.sectionFrameVisible ? Eye : EyeOff}
            label={state.sectionFrameVisible ? t('section.hideFrame') : t('section.showFrame')}
            active={state.sectionFrameVisible}
            size="sm"
            onClick={toggleFrame}
            data-testid="section-frame-toggle"
          />
          <IconButton icon={X} label={t('section.close')} size="sm" onClick={close} />
        </div>
      </div>

      {s.kind === 'plane' ? (
        <PlaneControls spec={s} bounds={bounds} />
      ) : (
        <BoxControls spec={s} bounds={bounds} />
      )}
    </div>
  );
}

function BoxControls({ spec, bounds }: { spec: Extract<SectionSpec, { kind: 'box' }>; bounds: Bounds }) {
  const { state, dispatch, viewer } = useApp();
  const { t } = useTranslation();
  const [localMin, setLocalMin] = useState<Vec3>(spec.min);
  const [localMax, setLocalMax] = useState<Vec3>(spec.max);
  const [inputErrors, setInputErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalMin(spec.min);
    setLocalMax(spec.max);
  }, [spec.min, spec.max]);

  useEffect(() => {
    if (!viewer) return;
    return viewer.on('sectionEdit', (ev) => {
      if (ev.spec.kind === 'box') {
        setLocalMin(ev.spec.min);
        setLocalMax(ev.spec.max);
      }
    });
  }, [viewer]);

  const commitBox = (newMin: Vec3, newMax: Vec3) => {
    for (let i = 0; i < 3; i++) {
      if (newMin[i]! >= newMax[i]!) return;
    }
    dispatch({
      type: 'setSection',
      section: { kind: 'box', min: newMin, max: newMax },
    });
  };

  const handleInputChange = (axis: 0 | 1 | 2, side: 'min' | 'max', rawValue: string) => {
    const val = parseFloat(rawValue);
    const key = `${axis}-${side}`;
    if (isNaN(val)) {
      setInputErrors((prev) => ({ ...prev, [key]: true }));
      return;
    }
    const currentMin = [...localMin] as Vec3;
    const currentMax = [...localMax] as Vec3;
    if (side === 'min') {
      if (val >= currentMax[axis]) {
        setInputErrors((prev) => ({ ...prev, [key]: true }));
        return;
      }
      setInputErrors((prev) => ({ ...prev, [key]: false }));
      currentMin[axis] = Math.round(val * 100) / 100;
      setLocalMin(currentMin);
      commitBox(currentMin, currentMax);
    } else {
      if (val <= currentMin[axis]) {
        setInputErrors((prev) => ({ ...prev, [key]: true }));
        return;
      }
      setInputErrors((prev) => ({ ...prev, [key]: false }));
      currentMax[axis] = Math.round(val * 100) / 100;
      setLocalMax(currentMax);
      commitBox(currentMin, currentMax);
    }
  };

  const handleSliderChange = (axis: 0 | 1 | 2, range: [number, number]) => {
    const [minVal, maxVal] = range;
    const nextMin = [...localMin] as Vec3;
    const nextMax = [...localMax] as Vec3;
    nextMin[axis] = minVal;
    nextMax[axis] = maxVal;
    setLocalMin(nextMin);
    setLocalMax(nextMax);
    commitBox(nextMin, nextMax);
  };

  const fitSelection = () => {
    if (!state.selection.length) return;
    const els = state.selection.map((id) => state.byId.get(id)!).filter(Boolean);
    const b = boundsOf(els);
    if (!isEmpty(b)) {
      const pb = pad(b, 0.6);
      dispatch({ type: 'setSection', section: { kind: 'box', min: pb.min, max: pb.max } });
    }
  };

  const fitModel = () => {
    const pb = pad(bounds, 0.01);
    dispatch({ type: 'setSection', section: { kind: 'box', min: pb.min, max: pb.max } });
  };

  const resetBox = () => {
    if (state.initialSectionBox) {
      dispatch({
        type: 'setSection',
        section: { kind: 'box', min: state.initialSectionBox.min, max: state.initialSectionBox.max },
      });
    }
  };

  const selectStorey = (index: number) => {
    const next = boxForStorey(state.model.storeys, index, { min: spec.min, max: spec.max }, bounds);
    dispatch({ type: 'setSection', section: { kind: 'box', min: next.min, max: next.max } });
  };

  const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];

  return (
    <div className="space-y-3">
      {axes.map((axis) => {
        const idx = AXIS_INDEX[axis];
        const axisMinBound = Math.min(bounds.min[idx], localMin[idx] - 1);
        const axisMaxBound = Math.max(bounds.max[idx], localMax[idx] + 1);

        return (
          <div key={axis} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className={AXIS_COLORS[axis]}>{axis.toUpperCase()}</span>
              <div className="flex items-center gap-1 font-mono text-[11px]">
                <input
                  type="number"
                  step="0.1"
                  aria-label={`${axis.toUpperCase()} Min`}
                  data-testid={`section-box-min-${axis}`}
                  value={localMin[idx]}
                  onChange={(e) => handleInputChange(idx, 'min', e.target.value)}
                  className={`w-16 rounded border px-1.5 py-0.5 text-right bg-surface ${
                    inputErrors[`${idx}-min`] ? 'border-red-500 text-red-500' : 'border-line text-ink'
                  }`}
                />
                <span className="text-muted">→</span>
                <input
                  type="number"
                  step="0.1"
                  aria-label={`${axis.toUpperCase()} Max`}
                  data-testid={`section-box-max-${axis}`}
                  value={localMax[idx]}
                  onChange={(e) => handleInputChange(idx, 'max', e.target.value)}
                  className={`w-16 rounded border px-1.5 py-0.5 text-right bg-surface ${
                    inputErrors[`${idx}-max`] ? 'border-red-500 text-red-500' : 'border-line text-ink'
                  }`}
                />
                <span className="text-muted text-[10px]">m</span>
              </div>
            </div>
            <RangePair
              min={Math.floor(axisMinBound * 10) / 10}
              max={Math.ceil(axisMaxBound * 10) / 10}
              step={0.1}
              value={[localMin[idx], localMax[idx]]}
              onChange={(range) => handleSliderChange(idx, range)}
            />
          </div>
        );
      })}

      <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
        <button
          type="button"
          data-testid="section-fit-selection"
          disabled={!state.selection.length}
          onClick={fitSelection}
          className="flex-1 rounded border border-line bg-surface px-2 py-1 text-xs font-medium text-ink hover:border-line-strong hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('section.fitSelection')}
        </button>
        <button
          type="button"
          data-testid="section-fit-model"
          onClick={fitModel}
          className="flex-1 rounded border border-line bg-surface px-2 py-1 text-xs font-medium text-ink hover:border-line-strong hover:bg-surface-hover"
        >
          {t('section.fitModel')}
        </button>
        <button
          type="button"
          data-testid="section-reset"
          disabled={!state.initialSectionBox}
          onClick={resetBox}
          className="rounded border border-line bg-surface px-2 py-1 text-xs font-medium text-ink hover:border-line-strong hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('section.reset')}
        </button>
      </div>

      {state.model.storeys.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-line/60">
          <div className="text-[11px] text-muted">{t('section.byStorey')}</div>
          <div className="flex flex-wrap gap-1">
            {state.model.storeys.map((st) => {
              const sorted = [...state.model.storeys].sort((a, b) => a.elevation - b.elevation);
              const sIdx = sorted.findIndex((s) => s.id === st.id);
              const zMin = st.elevation - 0.05;
              const nextS = sorted[sIdx + 1];
              const zMax = nextS ? nextS.elevation - 0.05 : bounds.max[2] + 0.5;
              const isCurrent = Math.abs(spec.min[2] - zMin) < 0.1 && Math.abs(spec.max[2] - zMax) < 0.1;

              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => selectStorey(sIdx)}
                  className={`rounded border px-1.5 py-0.5 text-[11px] ${
                    isCurrent
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-line text-muted hover:border-line-strong hover:text-ink'
                  }`}
                  title={`Cắt theo ${st.name}`}
                >
                  {st.name.replace(' (Ground)', '')}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PlaneControls({
  spec,
  bounds: b,
}: {
  spec: Extract<SectionSpec, { kind: 'plane' }>;
  bounds: Bounds;
}) {
  const { state, dispatch } = useApp();
  const { t } = useTranslation();
  const { axis, offset, flipped } = spec;
  const i = AXIS_INDEX[axis];
  const min = Math.floor(Math.min(b.min[i], offset - 1) * 10) / 10;
  const max = Math.ceil(Math.max(b.max[i], offset + 1) * 10) / 10;

  const set = (patch: Partial<{ axis: SectionAxis; offset: number; flipped: boolean }>) =>
    dispatch({ type: 'setSection', section: { kind: 'plane', axis, offset, flipped, ...patch } });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Segmented
          label="Section axis"
          value={axis}
          onChange={(a) => dispatch({ type: 'setSection', section: { ...defaultPlane(a, b, state.model?.storeys), flipped } })}
          options={[
            { value: 'x', label: 'X', title: t('section.cutAlongX') },
            { value: 'y', label: 'Y', title: t('section.cutAlongY') },
            { value: 'z', label: t('section.planCutZ'), title: t('section.planCutZ') },
          ]}
        />
        <IconButton icon={ArrowLeftRight} label={t('section.flipDirection')} active={flipped} onClick={() => set({ flipped: !flipped })} />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{t('section.offset')}</span>
          <div className="flex items-center gap-1 font-mono text-[11px]">
            <input
              type="number"
              step="0.1"
              value={offset}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) set({ offset: Math.round(val * 100) / 100 });
              }}
              className="w-16 rounded border border-line bg-surface px-1.5 py-0.5 text-right text-ink"
            />
            <span className="text-muted text-[10px]">m</span>
          </div>
        </div>
        <input
          type="range"
          className="jnn-range w-full"
          aria-label="Section offset"
          min={min}
          max={max}
          step={0.05}
          value={offset}
          onChange={(e) => set({ offset: Number(e.target.value) })}
        />
        <div className="hidden" data-testid="section-offset">
          {offset.toFixed(2)} m
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => dispatch({ type: 'setSectionPickMode', on: !state.sectionPickMode })}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded border px-2 py-1 text-xs font-medium transition ${
            state.sectionPickMode
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-hover'
          }`}
          title="Click vào bề mặt cấu kiện để đặt mặt phẳng cắt"
        >
          <Crosshair className="h-3.5 w-3.5" />
          <span>{t('section.pickFace')}</span>
        </button>
      </div>

      {axis === 'z' && state.model.storeys.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-line/60">
          <div className="text-[11px] text-muted">{t('section.byStorey')}</div>
          <div className="flex flex-wrap gap-1">
            {state.model.storeys.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => set({ offset: Math.round((st.elevation + 1.2) * 100) / 100, flipped: false })}
                className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:border-line-strong hover:text-ink"
                title={`Mặt cắt cách ${st.name} 1.2 m`}
              >
                {st.name.replace(' (Ground)', '')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

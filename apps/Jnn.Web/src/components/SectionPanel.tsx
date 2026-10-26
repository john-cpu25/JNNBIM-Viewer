import { ArrowLeftRight, X } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { defaultPlane } from '../state/store';
import { boundsOf, isEmpty } from '../domain/bounds';
import type { Bounds, SectionAxis, Vec3 } from '../viewer/ViewerAdapter';
import { IconButton, Segmented } from './ui';
import { useMemo } from 'react';
import { formatNumber } from '../lib/format';

const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const;

export function SectionPanel({ compact = false }: { compact?: boolean }) {
  const { state, dispatch } = useApp();
  const s = state.section!;
  const bounds = useMemo(() => {
    const b = boundsOf(state.model.elements);
    if (!isEmpty(b)) return b;
    if (state.model.storeys.length > 0) {
      const elevs = state.model.storeys.map((st) => st.elevation);
      const minZ = Math.min(...elevs);
      const maxZ = Math.max(...elevs) + 4.0;
      return { min: [-25, -25, minZ] as Vec3, max: [25, 25, maxZ] as Vec3 };
    }
    return { min: [-25, -25, -1] as Vec3, max: [25, 25, 20] as Vec3 };
  }, [state.model]);
  const close = () => dispatch({ type: 'setSection', section: null });

  return (
    <div
      data-testid="section-panel"
      className={`absolute left-2 z-20 w-[min(280px,calc(100%-16px))] ${compact ? 'top-[66px]' : 'top-2'} rounded-lg border border-line bg-surface/95 p-3 shadow-float backdrop-blur`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold">{s.kind === 'plane' ? 'Section plane' : 'Section box'}</div>
        <IconButton icon={X} label="Remove section" size="sm" onClick={close} />
      </div>
      {s.kind === 'plane' ? (
        <PlaneControls axis={s.axis} offset={s.offset} flipped={s.flipped} bounds={bounds} />
      ) : (
        <div className="space-y-1 text-xs text-muted tabular">
          {(['x', 'y', 'z'] as const).map((a) => (
            <div key={a} className="flex justify-between">
              <span className="uppercase">{a}</span>
              <span className="font-mono text-ink">
                {formatNumber(s.min[AXIS_INDEX[a]], 2)} → {formatNumber(s.max[AXIS_INDEX[a]], 2)} m
              </span>
            </div>
          ))}
          <p className="pt-1 text-faint">Box fitted to {state.selection.length ? 'the selection' : 'the model'}. Select elements and press B again to refit.</p>
        </div>
      )}
    </div>
  );
}

function PlaneControls({ axis, offset, flipped, bounds: b }: { axis: SectionAxis; offset: number; flipped: boolean; bounds: Bounds }) {
  const { state, dispatch } = useApp();
  const i = AXIS_INDEX[axis];
  const min = Math.floor(b.min[i] * 10) / 10;
  const max = Math.ceil(b.max[i] * 10) / 10;
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
            { value: 'x', label: 'X', title: 'Cut along X (east–west)' },
            { value: 'y', label: 'Y', title: 'Cut along Y (north–south)' },
            { value: 'z', label: 'Z · Plan', title: 'Horizontal plan cut' },
          ]}
        />
        <IconButton icon={ArrowLeftRight} label="Flip section direction" active={flipped} onClick={() => set({ flipped: !flipped })} />
      </div>
      <label className="block">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>Offset</span>
          <span className="font-mono text-ink tabular" data-testid="section-offset">{offset.toFixed(2)} m</span>
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
      </label>
      {axis === 'z' && (
        <div className="flex flex-wrap gap-1">
          {state.model.storeys.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => set({ offset: Math.round((st.elevation + 1.2) * 100) / 100, flipped: false })}
              className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:border-line-strong hover:text-ink"
              title={`Plan cut 1.2 m above ${st.name}`}
            >
              {st.name.replace(' (Ground)', '')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

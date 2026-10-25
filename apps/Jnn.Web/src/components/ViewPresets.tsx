import { useApp } from '../state/AppContext';
import type { ViewPreset } from '../viewer/ViewerAdapter';

const PRESETS: { id: ViewPreset; label: string; key: string }[] = [
  { id: 'iso', label: 'Iso', key: '1' },
  { id: 'top', label: 'Top', key: '2' },
  { id: 'front', label: 'Front', key: '3' },
  { id: 'right', label: 'Right', key: '4' },
  { id: 'back', label: 'Back', key: '5' },
  { id: 'left', label: 'Left', key: '6' },
];

export function ViewPresets() {
  const { viewer } = useApp();
  return (
    <nav
      aria-label="Standard views"
      className="absolute top-2 right-2 z-20 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line shadow-float"
    >
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          title={`${p.label} view (${p.key})`}
          onClick={() => viewer?.setViewPreset(p.id)}
          className="bg-surface/95 px-2.5 py-1 text-[11px] font-medium text-muted backdrop-blur hover:bg-surface-3 hover:text-ink"
        >
          {p.label}
        </button>
      ))}
    </nav>
  );
}

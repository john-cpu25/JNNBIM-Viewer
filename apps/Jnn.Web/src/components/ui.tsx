import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  active?: boolean;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function IconButton({ icon: Icon, label, shortcut, active, size = 'md', showLabel, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-muted transition-colors',
        'hover:bg-surface-3 hover:text-ink disabled:pointer-events-none disabled:opacity-40',
        size === 'md' ? 'h-8 min-w-8 px-1.5' : 'h-6 min-w-6 px-1',
        active && 'bg-accent-soft text-accent-ink hover:bg-accent-soft hover:text-accent-ink',
        className,
      )}
      {...rest}
    >
      <Icon size={size === 'md' ? 17 : 14} strokeWidth={1.75} aria-hidden />
      {showLabel && <span className="text-xs font-medium">{label}</span>}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Divider({ vertical }: { vertical?: boolean }) {
  return <div aria-hidden className={vertical ? 'mx-1 h-5 w-px shrink-0 bg-line' : 'my-1 h-px w-full bg-line'} />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{children}</div>;
}

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, ChevronRight, Copy, Crosshair, EyeOff, Focus, Info, MousePointerClick } from 'lucide-react';
import { useApp } from '../state/AppContext';
import type { JnnElement, PropertySet, PropertyValue } from '../domain/model';
import { categoryStyle } from '../viewer/categoryStyle';
import { aggregateQuantities, formatNumber, formatValue } from '../lib/format';
import { IconButton, SectionLabel } from './ui';
import { cn } from '../lib/cn';
import { useTranslation } from '../i18n';

export function Properties({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const { state } = useApp();
  const { t } = useTranslation();
  const sel = state.selection;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!hideHeader && (
        <div className="flex h-[41px] items-center border-b border-line px-3">
          <h2 className="text-xs font-semibold tracking-wide">{t('properties.title')}</h2>
          {sel.length > 1 && (
            <span className="ml-2 rounded bg-surface-3 px-1.5 text-[11px] text-muted tabular">
              {t('properties.selectionCount', { count: sel.length })}
            </span>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto scroll-thin" data-testid="properties-body">
        {sel.length === 0 && <ModelSummary />}
        {sel.length === 1 && <ElementProperties element={state.byId.get(sel[0]!)!} />}
        {sel.length > 1 && <MultiSummary ids={sel} />}
      </div>
    </div>
  );
}

function ModelSummary() {
  const { state } = useApp();
  const { t } = useTranslation();
  const m = state.model;
  const byCat = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of m.elements) c.set(e.category, (c.get(e.category) ?? 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1]);
  }, [m]);
  const max = byCat[0]?.[1] ?? 1;
  return (
    <div className="space-y-5 p-3">
      <div className="flex items-start gap-2 rounded-md border border-dashed border-line-strong p-3 text-xs text-muted">
        <MousePointerClick size={16} className="mt-0.5 shrink-0" />
        <span>{t('properties.noSelection')}</span>
      </div>
      <Block title="Model">
        <KV k="Name" v={m.name} />
        <KV k="Source format" v={<Badge>{m.sourceFormat}</Badge>} />
        {m.ifcSchema && <KV k="IFC Schema" v={<Mono>{m.ifcSchema}</Mono>} />}
        <KV k="Revision" v={<Mono>{m.modelRevisionId}</Mono>} />
        <KV k="Units" v={m.units} />
        <KV k="Schema" v={<Mono>v{m.schemaVersion}</Mono>} />
        <KV k="Elements" v={formatNumber(m.elements.length)} />
        <KV k="Storeys" v={m.storeys.length} />
        {m.application && <KV k="Application" v={m.application} />}
        {m.fileSize !== undefined && (
          <KV
            k="File size"
            v={
              m.fileSize > 1024 * 1024
                ? `${(m.fileSize / (1024 * 1024)).toFixed(2)} MB`
                : `${(m.fileSize / 1024).toFixed(1)} KB`
            }
          />
        )}
      </Block>
      <div>
        <SectionLabel>Elements by category</SectionLabel>
        <ul className="mt-2 space-y-1.5">
          {byCat.map(([cat, n]) => (
            <li key={cat} className="grid grid-cols-[88px_1fr_32px] items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 truncate">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: categoryStyle(cat).swatch }} />
                {cat}
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <span className="block h-full rounded-full bg-line-strong" style={{ width: `${(n / max) * 100}%` }} />
              </span>
              <span className="text-right text-muted tabular">{n}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[11px] leading-relaxed text-faint">
        {m.sourceFormat === 'IFC'
          ? t('properties.offlineDesc')
          : 'This is a procedurally generated sample building for UI development. IFC loading arrives with the That Open adapter (Milestone 1).'}
      </p>
    </div>
  );
}

function ElementActions({ ids }: { ids: string[] }) {
  const { dispatch, viewer } = useApp();
  return (
    <div className="flex gap-0.5">
      <IconButton icon={Crosshair} label="Zoom to" size="sm" onClick={() => viewer?.fitToView(ids)} />
      <IconButton icon={Focus} label="Isolate" size="sm" onClick={() => dispatch({ type: 'isolate', ids })} />
      <IconButton icon={EyeOff} label="Hide" size="sm" onClick={() => dispatch({ type: 'hide', ids })} />
    </div>
  );
}

function ElementProperties({ element: initialElement }: { element: JnnElement }) {
  const { viewer } = useApp();
  const { t } = useTranslation();
  const [lazyData, setLazyData] = useState<{ element: JnnElement; propertySets: PropertySet[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLazyData(null);

    if (viewer && initialElement && initialElement.properties.length === 0) {
      const res = viewer.getProperties(initialElement.id);
      if (res instanceof Promise) {
        res.then((r) => {
          if (!cancelled && r.ok) {
            setLazyData(r.value);
          }
        });
      } else if (res.ok) {
        setLazyData(res.value);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [viewer, initialElement.id]);

  const e = lazyData?.element
    ? {
        ...initialElement,
        ...lazyData.element,
        properties: lazyData.propertySets && lazyData.propertySets.length > 0 ? lazyData.propertySets : initialElement.properties,
        quantities: lazyData.element.quantities && lazyData.element.quantities.length > 0 ? lazyData.element.quantities : initialElement.quantities,
      }
    : initialElement;
  const style = categoryStyle(e.category);
  return (
    <div className="pb-6" data-testid="element-properties">
      <div className="border-b border-line p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-muted">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: style.swatch }} />
            {e.category}
          </div>
          <ElementActions ids={[e.id]} />
        </div>
        <div className="mt-1 text-sm leading-snug font-semibold" data-testid="element-name">
          {e.name}
        </div>
      </div>

      <Group title={t('properties.attributes')} defaultOpen>
        <KV k="GlobalId" v={e.globalId ? <Copyable text={e.globalId} /> : '—'} />
        <KV k="Source ID" v={<Mono>{e.sourceElementId}</Mono>} />
        <KV k="Source format" v={<Badge>{e.sourceFormat}</Badge>} />
        <KV k="Category" v={e.category} />
        <KV k="Type" v={e.type} />
        <KV k="Material" v={e.material ?? '—'} />
        <KV k="Storey" v={e.storey ?? '—'} />
        <KV k="Geometry" v={<GeometryStatusBadge status={e.geometryStatus} />} />
      </Group>

      {e.quantities.length > 0 && (
        <Group title={t('properties.quantities')} defaultOpen>
          {e.quantities.map((q) => (
            <KV
              key={q.name}
              k={q.name}
              v={
                <span className="tabular">
                  {formatNumber(q.value)} <span className="text-faint">{q.unit}</span>
                  {q.origin === 'computed' && (
                    <span className="ml-1 text-[10px] text-faint" title="Computed by JNN from geometry, not read from the source model">
                      calc
                    </span>
                  )}
                </span>
              }
            />
          ))}
        </Group>
      )}

      {e.properties.map((ps) => (
        <Group key={ps.name} title={ps.name} defaultOpen={ps.name.startsWith('Pset_')}>
          {Object.entries(ps.properties).map(([k, v]) => (
            <KV key={k} k={k} v={formatValue(v as PropertyValue)} />
          ))}
        </Group>
      ))}

      {e.importWarnings.length > 0 && (
        <Group title={`Import warnings (${e.importWarnings.length})`} defaultOpen>
          <ul className="space-y-1.5 py-1">
            {e.importWarnings.map((w) => (
              <li key={w.code} className="flex gap-2 text-xs">
                {w.severity === 'info' ? (
                  <Info size={14} className="mt-0.5 shrink-0 text-muted" />
                ) : (
                  <AlertTriangle size={14} className={cn('mt-0.5 shrink-0', w.severity === 'error' ? 'text-danger' : 'text-warn')} />
                )}
                <div>
                  <div className="font-mono text-[11px] text-faint">{w.code}</div>
                  <div className="text-muted">{w.message}</div>
                </div>
              </li>
            ))}
          </ul>
        </Group>
      )}
    </div>
  );
}

function MultiSummary({ ids }: { ids: string[] }) {
  const { state } = useApp();
  const { t } = useTranslation();
  const els = ids.map((id) => state.byId.get(id)!).filter(Boolean);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of els) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [els]);
  const totals = useMemo(() => aggregateQuantities(els.map((e) => e.quantities)), [els]);
  return (
    <div className="pb-6" data-testid="multi-properties">
      <div className="flex items-center justify-between border-b border-line p-3">
        <div className="text-sm font-semibold">{t('properties.selectionCount', { count: ids.length })}</div>
        <ElementActions ids={ids} />
      </div>
      <Group title="By category" defaultOpen>
        {byCat.map(([c, n]) => (
          <KV
            key={c}
            k={
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: categoryStyle(c).swatch }} />
                {c}
              </span>
            }
            v={<span className="tabular">{n}</span>}
          />
        ))}
      </Group>
      <Group title={t('properties.aggregateTitle')} defaultOpen>
        {totals.map((t) => (
          <KV
            key={`${t.name}|${t.unit}`}
            k={t.name}
            v={
              <span className="tabular" title={`Sum over ${t.count} element(s)`}>
                {formatNumber(t.total, 2)} <span className="text-faint">{t.unit}</span>
              </span>
            }
          />
        ))}
        <p className="pt-1 text-[11px] text-faint">Sums of per-element computed quantities; not a validated takeoff.</p>
      </Group>
    </div>
  );
}

// ---------------------------------------------------------------- primitives

function Group({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 px-3 py-2 text-left text-xs font-semibold hover:bg-surface-2"
      >
        <ChevronRight size={13} className={cn('text-faint transition-transform', open && 'rotate-90')} />
        {title}
      </button>
      {open && <div className="px-3 pb-2">{children}</div>}
    </section>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(96px,42%)_1fr] gap-2 py-[3px] text-xs">
      <div className="truncate text-muted">{k}</div>
      <div className="min-w-0 break-words text-ink">{v}</div>
    </div>
  );
}

const Mono = ({ children }: { children: ReactNode }) => <span className="font-mono text-[11.5px]">{children}</span>;

const Badge = ({ children }: { children: ReactNode }) => (
  <span className="rounded border border-line bg-surface-2 px-1.5 py-px font-mono text-[10.5px] text-muted">{children}</span>
);

function GeometryStatusBadge({ status }: { status: JnnElement['geometryStatus'] }) {
  const tone = status === 'ok' ? 'text-ok' : status === 'simplified' ? 'text-warn' : 'text-danger';
  return <span className={cn('font-medium', tone)}>{status}</span>;
}

function Copyable({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <Mono>{text}</Mono>
      <button
        type="button"
        aria-label="Copy GlobalId"
        title="Copy"
        className="rounded p-0.5 text-faint hover:text-ink"
        onClick={() => {
          navigator.clipboard?.writeText(text).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            },
            () => {},
          );
        }}
      >
        {copied ? <Check size={12} className="text-ok" /> : <Copy size={12} />}
      </button>
    </span>
  );
}

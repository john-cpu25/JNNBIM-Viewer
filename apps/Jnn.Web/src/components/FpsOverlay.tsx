import { useEffect, useState } from 'react';
import type { ViewerAdapter, FpsStats } from '../viewer/ViewerAdapter';

export function FpsOverlay({ viewer }: { viewer: ViewerAdapter | null }) {
  const [stats, setStats] = useState<FpsStats | null>(null);

  useEffect(() => {
    if (!viewer) return;
    const unsub = viewer.on('fpsStats', (s) => {
      setStats(s);
    });
    return unsub;
  }, [viewer]);

  return (
    <div
      data-testid="fps-debug-overlay"
      className="pointer-events-none absolute left-3 bottom-3 z-20 flex min-w-[210px] flex-col gap-1 rounded-lg border border-line bg-surface/90 px-3 py-2 font-mono text-[11px] shadow-float backdrop-blur"
    >
      <div className="flex items-center justify-between border-b border-line pb-1 font-semibold text-ink">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              stats?.active ? 'bg-accent animate-ping' : 'bg-emerald-500'
            }`}
          />
          <span>FPS Debug</span>
        </div>
        <span className="rounded bg-accent-soft px-1 text-[10px] text-accent">?debug=1</span>
      </div>
      {stats ? (
        <div className="space-y-0.5 text-muted">
          <div className="flex justify-between gap-4">
            <span>FPS trung bình:</span>
            <span className="font-semibold text-ink">{stats.avgFps.toFixed(1)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Frame dài nhất:</span>
            <span
              className={
                stats.maxFrameMs > 100
                  ? 'font-semibold text-rose-500'
                  : 'font-semibold text-ink'
              }
            >
              {stats.maxFrameMs.toFixed(1)} ms
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Frame &gt; 100ms:</span>
            <span
              className={
                stats.over100Count > 0
                  ? 'font-semibold text-rose-500'
                  : 'font-semibold text-emerald-500'
              }
            >
              {stats.over100Count}
            </span>
          </div>
          {stats.active && (
            <div className="pt-0.5 text-[10px] font-medium text-accent">Đang kéo...</div>
          )}
        </div>
      ) : (
        <div className="text-[10px] text-muted">Kéo chuột để đo FPS...</div>
      )}
    </div>
  );
}

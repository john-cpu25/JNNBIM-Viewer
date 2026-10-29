import { useEffect, useState } from 'react';
import { Compass, Database, HardDrive, RotateCcw, Trash2, X } from 'lucide-react';
import { clearIfcCache, getIfcCacheStats, isIndexedDBAvailable, type CacheStats } from '../lib/ifcCache';
import { formatBytes } from '../lib/format';
import { useApp } from '../state/AppContext';

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { state, dispatch } = useApp();
  const [stats, setStats] = useState<CacheStats>({ count: 0, totalBytes: 0, items: [] });
  const [loading, setLoading] = useState(false);
  const isIdbAvailable = isIndexedDBAvailable();

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await getIfcCacheStats();
      setStats(data);
    } catch (err) {
      console.warn('Failed to load cache stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadStats();
    }
  }, [open]);

  if (!open) return null;

  const handleClearCache = async () => {
    try {
      const ok = await clearIfcCache();
      if (ok) {
        dispatch({ type: 'notify', tone: 'info', text: 'Đã xóa toàn bộ bộ nhớ đệm IFC thành công.' });
        await loadStats();
      } else {
        dispatch({ type: 'notify', tone: 'error', text: 'Không thể xóa bộ nhớ đệm (IndexedDB bị khóa hoặc lỗi).' });
      }
    } catch (err) {
      dispatch({ type: 'notify', tone: 'error', text: `Lỗi khi xóa cache: ${err}` });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      data-testid="settings-modal"
    >
      <div className="flex w-full max-w-md flex-col rounded-xl border border-line bg-surface p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <HardDrive size={18} className="text-accent" />
            <h2 id="settings-title" className="text-sm font-semibold text-ink">
              Cài đặt & Quản lý Cache
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cài đặt"
            data-testid="close-settings-btn"
            className="rounded p-1 text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 py-4 text-xs max-h-[70vh] overflow-y-auto pr-1">
          {/* Navigation Section */}
          <div className="rounded-lg border border-line bg-surface-2 p-3" data-testid="nav-settings-section">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-ink">
                <Compass size={15} className="text-accent" />
                <span>Điều hướng chuột (Navigation)</span>
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: 'resetNavigation' })}
                className="flex items-center gap-1 text-[11px] text-muted transition hover:text-ink"
              >
                <RotateCcw size={12} />
                <span>Khôi phục mặc định</span>
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {/* Preset selection */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted">Sơ đồ chuột</label>
                <select
                  value={state.navigation.preset}
                  onChange={(e) =>
                    dispatch({
                      type: 'setNavigation',
                      settings: { preset: e.target.value as any },
                    })
                  }
                  className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                  data-testid="nav-preset-select"
                >
                  <option value="revit">Revit (Shift + kéo trái / giữa để xoay)</option>
                  <option value="classic">Cổ điển (Kéo trái để xoay)</option>
                </select>
              </div>

              {/* Rotate Speed Slider */}
              <div>
                <div className="flex justify-between text-[11px]">
                  <span className="font-medium text-muted">Tốc độ xoay</span>
                  <span className="font-mono text-ink">{Math.round(state.navigation.rotateSpeed * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={state.navigation.rotateSpeed}
                  onChange={(e) =>
                    dispatch({
                      type: 'setNavigation',
                      settings: { rotateSpeed: parseFloat(e.target.value) },
                    })
                  }
                  className="mt-1 w-full accent-accent"
                  data-testid="rotate-speed-slider"
                />
              </div>

              {/* Zoom Speed Slider */}
              <div>
                <div className="flex justify-between text-[11px]">
                  <span className="font-medium text-muted">Tốc độ zoom</span>
                  <span className="font-mono text-ink">{state.navigation.zoomSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="2.0"
                  step="0.1"
                  value={state.navigation.zoomSpeed}
                  onChange={(e) =>
                    dispatch({
                      type: 'setNavigation',
                      settings: { zoomSpeed: parseFloat(e.target.value) },
                    })
                  }
                  className="mt-1 w-full accent-accent"
                  data-testid="zoom-speed-slider"
                />
              </div>

              {/* Checkboxes */}
              <div className="space-y-1.5 pt-1">
                <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-ink">
                  <input
                    type="checkbox"
                    checked={state.navigation.orbitAroundCursor}
                    onChange={(e) =>
                      dispatch({
                        type: 'setNavigation',
                        settings: { orbitAroundCursor: e.target.checked },
                      })
                    }
                    className="rounded border-line accent-accent"
                  />
                  <span>Xoay quanh điểm dưới con trỏ</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-ink">
                  <input
                    type="checkbox"
                    checked={state.navigation.showPivot}
                    onChange={(e) =>
                      dispatch({
                        type: 'setNavigation',
                        settings: { showPivot: e.target.checked },
                      })
                    }
                    className="rounded border-line accent-accent"
                  />
                  <span>Hiện điểm tụ (chấm cam) khi xoay</span>
                </label>
              </div>
            </div>
          </div>

          {/* IndexedDB Cache Section */}
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <div className="flex items-center gap-2 font-medium text-ink">
              <Database size={15} className="text-accent" />
              <span>Bộ nhớ đệm mô hình (IndexedDB)</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Lưu trữ nhị phân hình học fragments (.frag) và dữ liệu cây cấu kiện để mở tức thì ở các lần xem tiếp theo
              (nhanh hơn 3x–20x) mà không cần phân tích lại từ file IFC gốc.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-md border border-line bg-surface p-2">
                <span className="block text-[10px] text-muted">Trạng thái</span>
                <span className="font-semibold text-ink" data-testid="cache-status-text">
                  {isIdbAvailable ? 'Hoạt động' : 'Không hỗ trợ'}
                </span>
              </div>
              <div className="rounded-md border border-line bg-surface p-2">
                <span className="block text-[10px] text-muted">Dung lượng đã cache</span>
                <span className="font-semibold text-ink" data-testid="cache-size-text">
                  {formatBytes(stats.totalBytes)} ({stats.count} file)
                </span>
              </div>
            </div>

            {/* Cached models list */}
            {stats.items.length > 0 && (
              <div className="mt-3 max-h-32 overflow-y-auto rounded border border-line bg-surface p-1.5 font-mono text-[10.5px]">
                {stats.items.map((item) => (
                  <div key={item.sha256} className="flex items-center justify-between py-0.5 text-muted">
                    <span className="truncate pr-2 font-sans font-medium text-ink">{item.filename}</span>
                    <span className="shrink-0">{formatBytes(item.cachedSize)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Clear cache button */}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleClearCache}
                disabled={loading || stats.count === 0}
                data-testid="clear-cache-btn"
                className="flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-500/20 disabled:opacity-40"
              >
                <Trash2 size={13} />
                <span>Xóa cache IFC</span>
              </button>
            </div>
          </div>

          {/* Attribution Section */}
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <span className="font-semibold text-ink">Bản quyền dữ liệu mẫu (Attribution)</span>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Mô hình mẫu mặc định (<span className="font-mono text-ink">Building-Architecture.ifc</span>,{' '}
              <span className="font-mono text-ink">Building-Structural.ifc</span>) thuộc bộ dữ liệu{' '}
              <strong className="text-ink">Simple-Scene</strong> của{' '}
              <strong className="text-ink">buildingSMART International</strong>, phát hành theo giấy phép{' '}
              <strong className="text-ink">Creative Commons Attribution 4.0 International (CC BY 4.0)</strong>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-line pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent hover:text-white"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

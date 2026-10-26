import { useEffect, useState } from 'react';
import { Database, HardDrive, Trash2, X } from 'lucide-react';
import { clearIfcCache, getIfcCacheStats, isIndexedDBAvailable, type CacheStats } from '../lib/ifcCache';
import { formatBytes } from '../lib/format';
import { useApp } from '../state/AppContext';

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { dispatch } = useApp();
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
        <div className="space-y-4 py-4 text-xs">
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

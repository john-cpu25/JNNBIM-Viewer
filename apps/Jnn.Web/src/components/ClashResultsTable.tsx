import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  Box,
  Maximize2,
  MessageSquare,
  Search,
  User,
  X,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import type { ClashRecord, ClashStatus } from '../clash/clashResults';
import { cn } from '../lib/cn';

interface ClashResultsTableProps {
  testId: string;
  records: ClashRecord[];
  selectedClashId: string | null;
  onSelectClash: (clashId: string | null) => void;
  onUpdateRecord: (clashId: string, updates: Partial<ClashRecord>) => void;
}

export function ClashResultsTable({
  testId: _testId,
  records,
  selectedClashId,
  onSelectClash,
  onUpdateRecord,
}: ClashResultsTableProps) {
  const { viewer } = useApp();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [enableSectionBox, setEnableSectionBox] = useState<boolean>(false);
  const tableRef = useRef<HTMLDivElement>(null);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesA = (r.aName || '').toLowerCase().includes(q) || (r.aGuid || '').toLowerCase().includes(q);
        const matchesB = (r.bName || '').toLowerCase().includes(q) || (r.bGuid || '').toLowerCase().includes(q);
        const matchesStorey = (r.aStorey || '').toLowerCase().includes(q) || (r.bStorey || '').toLowerCase().includes(q);
        if (!matchesName && !matchesA && !matchesB && !matchesStorey) return false;
      }
      return true;
    });
  }, [records, statusFilter, typeFilter, searchQuery]);

  // Selected record
  const selectedRecord = useMemo(() => {
    return records.find((r) => r.clashId === selectedClashId) || null;
  }, [records, selectedClashId]);

  // Highlight & camera zoom when a clash is selected
  useEffect(() => {
    if (!viewer) return;

    if (!selectedRecord) {
      viewer.highlight(null);
      if (enableSectionBox) {
        viewer.setSection(null);
      }
      return;
    }

    const idA = String(selectedRecord.aId);
    const idB = String(selectedRecord.bId);

    // 1. Highlight A as RED (#ef4444) and B as GREEN (#22c55e)
    const highlightMap = new Map<string, string>([
      [idA, '#ef4444'],
      [idB, '#22c55e'],
    ]);
    viewer.highlight(highlightMap);

    // 2. Camera zoom fit to both elements
    viewer.fitToView([idA, idB]);

    // 3. Section box around clash point if enabled
    if (enableSectionBox && selectedRecord.point) {
      const [px, py, pz] = selectedRecord.point;
      const radius = 1.2; // 2.4m cube
      viewer.setSection({
        kind: 'box',
        min: [px - radius, py - radius, pz - radius],
        max: [px + radius, py + radius, pz + radius],
      });
    } else {
      viewer.setSection(null);
    }
  }, [selectedRecord, viewer, enableSectionBox]);

  // Handle keyboard navigation: Up/Down arrow and 1-5 for status
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (filteredRecords.length === 0) return;

    const currentIndex = filteredRecords.findIndex((r) => r.clashId === selectedClashId);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex < filteredRecords.length - 1 ? currentIndex + 1 : 0;
      onSelectClash(filteredRecords[nextIndex]!.clashId);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredRecords.length - 1;
      onSelectClash(filteredRecords[prevIndex]!.clashId);
    } else if (selectedRecord) {
      const statusKeys: Record<string, ClashStatus> = {
        '1': 'New',
        '2': 'Active',
        '3': 'Reviewed',
        '4': 'Approved',
        '5': 'Resolved',
      };
      if (statusKeys[e.key]) {
        e.preventDefault();
        onUpdateRecord(selectedRecord.clashId, { status: statusKeys[e.key] });
      }
    }
  };

  const statusBadge = (status: ClashStatus) => {
    switch (status) {
      case 'New':
        return <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-500">New</span>;
      case 'Active':
        return <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">Active</span>;
      case 'Reviewed':
        return <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-500">Reviewed</span>;
      case 'Approved':
        return <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500">Approved</span>;
      case 'Resolved':
        return <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold text-muted line-through">Resolved</span>;
    }
  };

  return (
    <div
      ref={tableRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex h-full min-h-0 flex-1 flex-col outline-none"
      data-testid="clash-results-container"
    >
      {/* Filter and search toolbar */}
      <div className="space-y-2 border-b border-line p-2 bg-surface-2/40">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2 top-2 text-muted" />
            <input
              type="text"
              placeholder="Tìm theo tên, GUID, tầng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="clash-search-input"
              className="w-full rounded border border-line bg-surface py-1 pl-7 pr-2 text-xs text-ink outline-none focus:border-accent"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            data-testid="status-filter-select"
            className="rounded border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
          >
            <option value="ALL">Tất cả ({records.length})</option>
            <option value="New">New</option>
            <option value="Active">Active</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Approved">Approved</option>
            <option value="Resolved">Resolved</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            data-testid="type-filter-select"
            className="rounded border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
          >
            <option value="ALL">Mọi loại</option>
            <option value="Hard">Hard</option>
            <option value="Clearance">Clearance</option>
            <option value="Duplicates">Duplicates</option>
          </select>
        </div>

        {/* Section box toggle & shortcut hint */}
        <div className="flex items-center justify-between text-[11px] text-muted">
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-ink">
            <input
              type="checkbox"
              checked={enableSectionBox}
              data-testid="section-box-checkbox"
              onChange={(e) => setEnableSectionBox(e.target.checked)}
              className="rounded border-line text-accent"
            />
            <span className="flex items-center gap-1">
              <Box size={12} className="text-accent" />
              Section box quanh va chạm
            </span>
          </label>
          <span className="text-[10px] text-faint">Phím: ↑↓ chuyển, 1–5 đổi trạng thái</span>
        </div>
      </div>

      {/* Table listing */}
      <div className="min-h-0 flex-1 overflow-auto scroll-thin" data-testid="clash-results-table">
        {filteredRecords.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted">
            Không tìm thấy va chạm nào phù hợp.
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-line bg-surface-2 text-[11px] font-semibold text-muted">
              <tr>
                <th className="py-1.5 px-2">#</th>
                <th className="py-1.5 px-2">Trạng thái</th>
                <th className="py-1.5 px-2">Loại</th>
                <th className="py-1.5 px-2">Khoảng cách</th>
                <th className="py-1.5 px-2">Phần tử A</th>
                <th className="py-1.5 px-2">Phần tử B</th>
                <th className="py-1.5 px-2">Tầng</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => {
                const isSelected = r.clashId === selectedClashId;
                return (
                  <tr
                    key={r.clashId}
                    onClick={() => onSelectClash(r.clashId)}
                    data-testid={`clash-row-${r.clashId}`}
                    className={cn(
                      'border-b border-line/50 cursor-pointer transition-colors',
                      isSelected
                        ? 'bg-accent/20 font-medium text-ink'
                        : 'hover:bg-surface-2 text-muted hover:text-ink',
                    )}
                  >
                    <td className="py-1 px-2 font-mono text-[11px]">{r.name}</td>
                    <td className="py-1 px-2">{statusBadge(r.status)}</td>
                    <td className="py-1 px-2 text-[11px]">{r.type}</td>
                    <td className="py-1 px-2 font-mono text-[11px] tabular">
                      {r.distance === 0 ? '0.000 m' : `${r.distance.toFixed(3)} m`}
                    </td>
                    <td className="py-1 px-2 truncate max-w-[100px]" title={r.aName}>
                      {r.aName}
                    </td>
                    <td className="py-1 px-2 truncate max-w-[100px]" title={r.bName}>
                      {r.bName}
                    </td>
                    <td className="py-1 px-2 text-[11px]">{r.aStorey || r.bStorey || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Selected clash details inspector */}
      {selectedRecord && (
        <div
          className="border-t border-line bg-surface-2/60 p-2.5 space-y-2 text-xs"
          data-testid="clash-inspector"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-ink">{selectedRecord.name}</span>
              {statusBadge(selectedRecord.status)}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  viewer?.fitToView([String(selectedRecord.aId), String(selectedRecord.bId)]);
                }}
                title="Zoom lại điểm va chạm"
                data-testid="fit-clash-btn"
                className="flex items-center gap-1 rounded bg-surface border border-line px-2 py-0.5 text-[11px] hover:border-accent text-ink"
              >
                <Maximize2 size={11} />
                <span>Zoom</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectClash(null)}
                title="Đóng chi tiết"
                className="p-1 rounded text-muted hover:text-ink"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Quick status buttons */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted">Trạng thái:</span>
            {(['New', 'Active', 'Reviewed', 'Approved', 'Resolved'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onUpdateRecord(selectedRecord.clashId, { status: s })}
                data-testid={`set-status-${s.toLowerCase()}`}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10.5px] transition-colors',
                  selectedRecord.status === s
                    ? 'bg-accent text-white font-semibold'
                    : 'bg-surface border border-line text-muted hover:text-ink',
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Elements metadata */}
          <div className="grid grid-cols-2 gap-2 rounded bg-surface p-2 border border-line text-[11px]">
            <div>
              <span className="font-semibold text-rose-500 block">Phần tử A (Đỏ):</span>
              <span className="truncate block font-medium text-ink">{selectedRecord.aName}</span>
              <span className="text-muted block text-[10px]">GUID: {selectedRecord.aGuid || '—'}</span>
            </div>
            <div>
              <span className="font-semibold text-emerald-500 block">Phần tử B (Xanh):</span>
              <span className="truncate block font-medium text-ink">{selectedRecord.bName}</span>
              <span className="text-muted block text-[10px]">GUID: {selectedRecord.bGuid || '—'}</span>
            </div>
          </div>

          {/* Assigned & comments */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <label className="text-[10.5px] text-muted flex items-center gap-1">
                <User size={10} />
                Người phụ trách
              </label>
              <input
                type="text"
                placeholder="ví dụ: KTS Tuấn"
                value={selectedRecord.assignedTo || ''}
                data-testid="assigned-to-input"
                onChange={(e) =>
                  onUpdateRecord(selectedRecord.clashId, { assignedTo: e.target.value })
                }
                className="w-full rounded border border-line bg-surface px-2 py-0.5 text-xs text-ink outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-0.5">
              <label className="text-[10.5px] text-muted flex items-center gap-1">
                <MessageSquare size={10} />
                Ghi chú
              </label>
              <input
                type="text"
                placeholder="Ghi chú đánh giá..."
                value={selectedRecord.comments || ''}
                data-testid="comments-input"
                onChange={(e) =>
                  onUpdateRecord(selectedRecord.clashId, { comments: e.target.value })
                }
                className="w-full rounded border border-line bg-surface px-2 py-0.5 text-xs text-ink outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

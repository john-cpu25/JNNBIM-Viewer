import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  Box,
  ChevronDown,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  Maximize2,
  MessageSquare,
  Search,
  User,
  X,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import type { ClashRecord, ClashStatus } from '../clash/clashResults';
import type { ClashTestItem } from '../clash/clashState';
import { exportClashCSV, exportClashExcel, exportClashHTML, downloadFile } from '../clash/clashExport';
import { exportClashTestToBCF } from '../clash/bcfExport';
import { cn } from '../lib/cn';
import { useTranslation } from '../i18n';

interface ClashResultsTableProps {
  testId: string;
  test?: ClashTestItem;
  records: ClashRecord[];
  selectedClashId: string | null;
  onSelectClash: (clashId: string | null) => void;
  onUpdateRecord: (clashId: string, updates: Partial<ClashRecord>) => void;
}

export function ClashResultsTable({
  testId,
  test,
  records,
  selectedClashId,
  onSelectClash,
  onUpdateRecord,
}: ClashResultsTableProps) {
  const { viewer, dispatch } = useApp();
  const { t, locale } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [enableSectionBox, setEnableSectionBox] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    }
    if (isExportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportOpen]);

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
        dispatch({ type: 'setSection', section: null });
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
      dispatch({
        type: 'setSection',
        section: {
          kind: 'box',
          min: [px - radius, py - radius, pz - radius],
          max: [px + radius, py + radius, pz + radius],
        },
      });
    } else {
      dispatch({ type: 'setSection', section: null });
    }
  }, [selectedRecord, viewer, dispatch, enableSectionBox]);

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

  const currentTest = useMemo<ClashTestItem>(() => {
    return (
      test ?? {
        id: testId,
        name: 'Clash_Test',
        type: 'Hard',
        tolerance: 0,
        selectionA: {},
        selectionB: {},
        status: 'completed',
        records,
      }
    );
  }, [test, testId, records]);

  const handleExportCSV = () => {
    setIsExportOpen(false);
    const csv = exportClashCSV(currentTest, locale);
    const filename = `${(currentTest.name || 'clash_report').replace(/\s+/g, '_')}_${Date.now()}.csv`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8');
  };

  const handleExportExcel = async () => {
    setIsExportOpen(false);
    try {
      const blob = await exportClashExcel(currentTest, locale);
      const filename = `${(currentTest.name || 'clash_report').replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
      downloadFile(blob, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert(t('clash.errorExportExcel', { error: (err as Error).message }));
    }
  };

  const handleExportHTML = () => {
    setIsExportOpen(false);
    try {
      const html = exportClashHTML(currentTest, locale);
      const filename = `${(currentTest.name || 'clash_report').replace(/\s+/g, '_')}_${Date.now()}.html`;
      downloadFile(html, filename, 'text/html;charset=utf-8');
    } catch (err) {
      console.error('Failed to export HTML:', err);
      alert(t('clash.errorExportHtml', { error: (err as Error).message }));
    }
  };

  const handleExportBCF = async () => {
    setIsExportOpen(false);
    try {
      const blob = await exportClashTestToBCF(currentTest);
      const filename = `${(currentTest.name || 'clash_bcf').replace(/\s+/g, '_')}_${Date.now()}.bcf`;
      downloadFile(blob, filename, 'application/zip');
    } catch (err) {
      console.error('Failed to export BCF:', err);
      alert(t('clash.errorExportBcf', { error: (err as Error).message }));
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
              placeholder={t('clash.searchPlaceholderFilter')}
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
            <option value="ALL">{t('clash.filterAllCount', { count: records.length })}</option>
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
            <option value="ALL">{t('clash.filterAllTypes')}</option>
            <option value="Hard">Hard</option>
            <option value="Clearance">Clearance</option>
            <option value="Duplicates">Duplicates</option>
          </select>

          {/* Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setIsExportOpen(!isExportOpen)}
              data-testid="export-dropdown-btn"
              className="flex items-center gap-1 rounded border border-line bg-surface px-2 py-1 text-xs text-ink hover:bg-surface-2 hover:border-accent transition-colors"
              title={t('clash.export')}
            >
              <Download size={12} className="text-muted" />
              <span>{t('clash.export')}</span>
              <ChevronDown size={11} className={cn('text-muted transition-transform', isExportOpen && 'rotate-180')} />
            </button>
            {isExportOpen && (
              <div
                data-testid="export-dropdown-menu"
                className="absolute right-0 top-full mt-1 z-30 w-44 rounded-md border border-line bg-surface p-1 shadow-xl text-xs"
              >
                <button
                  type="button"
                  data-testid="export-csv-btn"
                  onClick={handleExportCSV}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-ink hover:bg-accent/10 hover:text-accent transition-colors"
                >
                  <FileText size={13} className="text-muted" />
                  <span>{t('clash.exportCsv')}</span>
                </button>
                <button
                  type="button"
                  data-testid="export-excel-btn"
                  onClick={handleExportExcel}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-ink hover:bg-accent/10 hover:text-accent transition-colors"
                >
                  <FileSpreadsheet size={13} className="text-muted" />
                  <span>{t('clash.exportExcel')}</span>
                </button>
                <button
                  type="button"
                  data-testid="export-html-btn"
                  onClick={handleExportHTML}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-ink hover:bg-accent/10 hover:text-accent transition-colors"
                >
                  <FileCode size={13} className="text-muted" />
                  <span>{t('clash.exportHtml')}</span>
                </button>
                <button
                  type="button"
                  data-testid="export-bcf-btn"
                  onClick={handleExportBCF}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-ink hover:bg-accent/10 hover:text-accent transition-colors"
                >
                  <FolderArchive size={13} className="text-muted" />
                  <span>{t('clash.exportBcf')}</span>
                </button>
              </div>
            )}
          </div>
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
              {t('clash.enableSectionBox')}
            </span>
          </label>
          <span className="text-[10px] text-faint">{t('clash.shortcutsHint')}</span>
        </div>
      </div>

      {/* Table listing */}
      <div className="min-h-0 flex-1 overflow-auto scroll-thin" data-testid="clash-results-table">
        {filteredRecords.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted">
            {t('clash.noResults')}
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-line bg-surface-2 text-[11px] font-semibold text-muted">
              <tr>
                <th className="py-1.5 px-2">{t('clash.colIndex')}</th>
                <th className="py-1.5 px-2">{t('clash.colStatus')}</th>
                <th className="py-1.5 px-2">{t('clash.colType')}</th>
                <th className="py-1.5 px-2">{t('clash.colDistance')}</th>
                <th className="py-1.5 px-2">{t('clash.colElementA')}</th>
                <th className="py-1.5 px-2">{t('clash.colElementB')}</th>
                <th className="py-1.5 px-2">{t('clash.colStorey')}</th>
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
                title={t('clash.zoomClash')}
                data-testid="fit-clash-btn"
                className="flex items-center gap-1 rounded bg-surface border border-line px-2 py-0.5 text-[11px] hover:border-accent text-ink"
              >
                <Maximize2 size={11} />
                <span>Zoom</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectClash(null)}
                title={t('clash.closeDetail')}
                className="p-1 rounded text-muted hover:text-ink"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Quick status buttons */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted">{t('clash.statusLabel')}</span>
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
              <span className="font-semibold text-rose-500 block">{t('clash.elementALabel')}</span>
              <span className="truncate block font-medium text-ink">{selectedRecord.aName}</span>
              <span className="text-muted block text-[10px]">GUID: {selectedRecord.aGuid || '—'}</span>
            </div>
            <div>
              <span className="font-semibold text-emerald-500 block">{t('clash.elementBLabel')}</span>
              <span className="truncate block font-medium text-ink">{selectedRecord.bName}</span>
              <span className="text-muted block text-[10px]">GUID: {selectedRecord.bGuid || '—'}</span>
            </div>
          </div>

          {/* Assigned & comments */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <label className="text-[10.5px] text-muted flex items-center gap-1">
                <User size={10} />
                {t('clash.assignedToLabel')}
              </label>
              <input
                type="text"
                placeholder={t('clash.assignedToPlaceholder')}
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
                {t('clash.colComments')}
              </label>
              <input
                type="text"
                placeholder={t('clash.commentsPlaceholder')}
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

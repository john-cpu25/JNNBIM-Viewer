import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Play, 
  RotateCw, 
  Download, 
  CheckCircle2, 
  Clock, 
  User, 
  Calendar, 
  Sliders, 
  Filter, 
  Layers, 
  ChevronRight,
  Eye,
  Check,
  FileSpreadsheet
} from 'lucide-react';
import { ViewerAdapter } from '../../adapters/ViewerAdapter';
import { ClashTest, ClashResultItem, ClashStatus, ClashSeverity } from '../../types/bim';

interface ClashWorkspaceProps {
  adapter: ViewerAdapter;
  clashTests: ClashTest[];
  activeClashId: string | null;
  onSelectClash: (clash: ClashResultItem) => void;
}

export const ClashWorkspace: React.FC<ClashWorkspaceProps> = ({
  adapter,
  clashTests,
  activeClashId,
  onSelectClash
}) => {
  const [selectedTestId, setSelectedTestId] = useState<string>(clashTests[0]?.id || 'TEST-001');
  const [statusFilter, setStatusFilter] = useState<'All' | ClashStatus>('All');
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [clashes, setClashes] = useState<ClashResultItem[]>(clashTests[0]?.results || []);
  const [activeClash, setActiveClash] = useState<ClashResultItem | null>(
    clashTests[0]?.results.find(c => c.id === activeClashId) || clashTests[0]?.results[0] || null
  );

  const activeTest = clashTests.find(t => t.id === selectedTestId) || clashTests[0];

  const filteredClashes = clashes.filter(c => {
    if (statusFilter === 'All') return true;
    return c.status === statusFilter;
  });

  const handleRowClick = (clash: ClashResultItem) => {
    setActiveClash(clash);
    onSelectClash(clash);
    adapter.highlightClashPair(clash.elementA.id, clash.elementB.id, clash.intersectionPoint);
  };

  const handleUpdateStatus = (clashId: string, newStatus: ClashStatus) => {
    setClashes(prev => prev.map(c => c.id === clashId ? { ...c, status: newStatus } : c));
    if (activeClash?.id === clashId) {
      setActiveClash(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const handleUpdateAssignee = (clashId: string, newAssignee: string) => {
    setClashes(prev => prev.map(c => c.id === clashId ? { ...c, assignedTo: newAssignee } : c));
    if (activeClash?.id === clashId) {
      setActiveClash(prev => prev ? { ...prev, assignedTo: newAssignee } : null);
    }
  };

  const handleRunTest = () => {
    setIsRunningTest(true);
    setTimeout(() => {
      setIsRunningTest(false);
      adapter.clearClashHighlight();
      if (clashes.length > 0) {
        handleRowClick(clashes[0]);
      }
    }, 1200);
  };

  const handleExportCsv = () => {
    const headers = ['Clash ID', 'Status', 'Severity', 'Item A Name', 'Item A Category', 'Item B Name', 'Item B Category', 'Overlap (mm)', 'Grid Location', 'Assigned To', 'Due Date'];
    const rows = clashes.map(c => [
      c.id,
      c.status,
      c.severity,
      `"${c.elementA.name}"`,
      c.elementA.category,
      `"${c.elementB.name}"`,
      c.elementB.category,
      c.intersectionDistance,
      c.gridLocation,
      `"${c.assignedTo}"`,
      c.dueDate
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `JNN_Clash_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: ClashStatus) => {
    switch (status) {
      case 'New':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-400 border border-blue-800">New</span>;
      case 'Active':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800 animate-pulse">Active</span>;
      case 'Reviewed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-400 border border-purple-800">Reviewed</span>;
      case 'Approved':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">Approved</span>;
      case 'Resolved':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">Resolved</span>;
    }
  };

  const getSeverityBadge = (sev: ClashSeverity) => {
    switch (sev) {
      case 'Critical':
        return <span className="text-rose-400 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-rose-500" /> Critical</span>;
      case 'Major':
        return <span className="text-amber-400 font-medium">Major</span>;
      case 'Minor':
        return <span className="text-slate-400 font-normal">Minor</span>;
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none flex flex-col justify-end p-3 z-20">
      {/* Clash Manager Drawer Panel */}
      <div className="pointer-events-auto h-[380px] bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-color)] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Coordination Toolbar */}
        <div className="p-3 bg-[var(--bg-elevated)] border-b border-[var(--border-color)] flex items-center justify-between flex-wrap gap-2">
          {/* Test Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span className="font-bold text-[13px] text-[var(--text-primary)]">Clash Detective:</span>
            </div>

            <select
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[12px] font-semibold text-cyan-400 rounded px-2.5 py-1 focus:outline-none focus:border-cyan-500"
            >
              {clashTests.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {/* Selection Set Indicators */}
            <div className="hidden md:flex items-center gap-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/60 font-semibold">
                Set A: {activeTest.categoryA}
              </span>
              <span className="text-[var(--text-muted)] font-bold">vs</span>
              <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-semibold">
                Set B: {activeTest.categoryB}
              </span>
              <span className="text-[var(--text-muted)]">|</span>
              <span className="text-[var(--text-muted)]">Tolerance: <strong className="text-[var(--text-primary)]">{activeTest.tolerance} mm</strong></span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunTest}
              disabled={isRunningTest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[12px] transition-colors shadow-md shadow-cyan-900/30 disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRunningTest ? 'animate-spin' : ''}`} />
              <span>{isRunningTest ? 'Detecting Clashes...' : 'Re-Run Test'}</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-color)] font-medium text-[12px] transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-3 py-1.5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[var(--text-muted)] mr-1" />
            {(['All', 'Active', 'New', 'Reviewed', 'Approved', 'Resolved'] as const).map(st => {
              const count = st === 'All' ? clashes.length : clashes.filter(c => c.status === st).length;
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    statusFilter === st 
                      ? 'bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold' 
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {st} ({count})
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-[var(--text-muted)] italic">
            Click row to auto-focus 3D camera & isolate Item A (Red) vs Item B (Cyan)
          </div>
        </div>

        {/* Split View: Table on Left + Clash Resolution Card on Right */}
        <div className="flex-1 flex overflow-hidden">
          {/* Clash Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left engineering-table border-collapse">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Item A (Structure)</th>
                  <th>Item B (MEP/Trade)</th>
                  <th>Overlap</th>
                  <th>Location</th>
                  <th>Assigned To</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredClashes.map(clash => {
                  const isSelected = activeClash?.id === clash.id;
                  return (
                    <tr
                      key={clash.id}
                      onClick={() => handleRowClick(clash)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'selected font-medium' : ''}`}
                    >
                      <td className="font-mono font-bold text-cyan-400">{clash.id}</td>
                      <td>{getStatusBadge(clash.status)}</td>
                      <td>{getSeverityBadge(clash.severity)}</td>
                      <td>
                        <div className="font-medium text-[var(--text-primary)] truncate max-w-[180px]" title={clash.elementA.name}>
                          {clash.elementA.name}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">{clash.elementA.category}</div>
                      </td>
                      <td>
                        <div className="font-medium text-[var(--text-primary)] truncate max-w-[180px]" title={clash.elementB.name}>
                          {clash.elementB.name}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">{clash.elementB.category}</div>
                      </td>
                      <td className="font-mono text-rose-400 font-bold">{clash.intersectionDistance} mm</td>
                      <td className="font-mono text-[var(--text-secondary)]">{clash.gridLocation}</td>
                      <td className="text-[var(--text-secondary)]">{clash.assignedTo}</td>
                      <td className="font-mono text-[var(--text-muted)]">{clash.dueDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Clash Resolution Inspector Card on Right */}
          {activeClash && (
            <div className="w-80 border-l border-[var(--border-color)] bg-[var(--bg-elevated)] p-3 flex flex-col justify-between overflow-y-auto text-[11px] shrink-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[13px] text-cyan-400">{activeClash.id} Details</span>
                  {getStatusBadge(activeClash.status)}
                </div>

                {/* Status Updater */}
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">
                    Update Coordination Status
                  </label>
                  <select
                    value={activeClash.status}
                    onChange={(e) => handleUpdateStatus(activeClash.id, e.target.value as ClashStatus)}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded p-1.5 text-[11px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-cyan-500"
                  >
                    <option value="New">New</option>
                    <option value="Active">Active (Confirmed Collision)</option>
                    <option value="Reviewed">Reviewed (In Discussion)</option>
                    <option value="Approved">Approved (Waiver Accepted)</option>
                    <option value="Resolved">Resolved (Cleared)</option>
                  </select>
                </div>

                {/* Assignee Updater */}
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">
                    Assigned Engineer
                  </label>
                  <select
                    value={activeClash.assignedTo}
                    onChange={(e) => handleUpdateAssignee(activeClash.id, e.target.value)}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded p-1.5 text-[11px] text-[var(--text-primary)] focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Nguyen Van A (MEP Lead)">Nguyen Van A (MEP Lead)</option>
                    <option value="Tran Minh T (Plumbing)">Tran Minh T (Plumbing)</option>
                    <option value="Le Hoang K (BIM Coordinator)">Le Hoang K (BIM Coordinator)</option>
                    <option value="Pham Vu N (Civil)">Pham Vu N (Civil)</option>
                  </select>
                </div>

                {/* Conflict Elements Details */}
                <div className="bg-[var(--bg-surface)] p-2 rounded border border-[var(--border-subtle)] space-y-1.5">
                  <div className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>ITEM A: {activeClash.elementA.name}</span>
                  </div>
                  <div className="text-[10px] font-bold text-cyan-400 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>ITEM B: {activeClash.elementB.name}</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono pt-1 border-t border-[var(--border-subtle)]">
                    Coords: ({activeClash.intersectionPoint.map(p => p.toFixed(2)).join(', ')})
                  </div>
                </div>

                {/* Resolution Notes */}
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">
                    Coordination Notes & Instructions
                  </label>
                  <div className="p-2 bg-[var(--bg-surface)] rounded border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {activeClash.notes || 'No coordination notes entered.'}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => adapter.highlightClashPair(activeClash.elementA.id, activeClash.elementB.id, activeClash.intersectionPoint)}
                  className="w-full py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 font-semibold text-[11px] flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Re-Focus Camera on Clash</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

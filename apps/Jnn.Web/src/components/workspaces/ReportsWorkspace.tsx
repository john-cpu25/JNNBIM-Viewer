import React, { useState } from 'react';
import { 
  FileText, 
  MessageSquare, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  User, 
  Download, 
  Send, 
  Plus, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { BcfIssue, BcfComment } from '../../types/bim';
import { ViewerAdapter } from '../../adapters/ViewerAdapter';

interface ReportsWorkspaceProps {
  adapter: ViewerAdapter;
  issues: BcfIssue[];
  onSelectIssue: (issue: BcfIssue) => void;
}

export const ReportsWorkspace: React.FC<ReportsWorkspaceProps> = ({
  adapter,
  issues,
  onSelectIssue
}) => {
  const [issueList, setIssueList] = useState<BcfIssue[]>(issues);
  const [selectedIssueId, setSelectedIssueId] = useState<string>(issues[0]?.id || '');
  const [newComment, setNewComment] = useState('');
  const [reportGenerated, setReportGenerated] = useState(false);

  const activeIssue = issueList.find(i => i.id === selectedIssueId) || issueList[0];

  const handleAddComment = () => {
    if (!newComment.trim() || !activeIssue) return;

    const comment: BcfComment = {
      id: `c_${Date.now()}`,
      author: 'Nguyen Nhan (Lead BIM)',
      avatar: 'NN',
      date: 'Just now',
      text: newComment.trim()
    };

    setIssueList(prev => prev.map(issue => {
      if (issue.id === activeIssue.id) {
        return {
          ...issue,
          comments: [...issue.comments, comment]
        };
      }
      return issue;
    }));

    setNewComment('');
  };

  const handleRestoreViewpoint = (issue: BcfIssue) => {
    onSelectIssue(issue);
    if (issue.viewpoint.selectedElementIds.length >= 2) {
      adapter.highlightClashPair(
        issue.viewpoint.selectedElementIds[0],
        issue.viewpoint.selectedElementIds[1]
      );
    } else {
      adapter.fitToView(issue.viewpoint.selectedElementIds);
    }
  };

  const handleGeneratePdf = () => {
    setReportGenerated(true);
    setTimeout(() => setReportGenerated(false), 3500);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none flex flex-col justify-end p-3 z-20">
      <div className="pointer-events-auto h-[420px] bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-color)] rounded-xl shadow-2xl flex flex-col overflow-hidden select-none">
        {/* Workspace Ribbon Header */}
        <div className="p-3 bg-[var(--bg-elevated)] border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-[13px] text-[var(--text-primary)]">Online Reports & BCF Coordination Issues</span>
            <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800">
              {issueList.length} Active Topics
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGeneratePdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[11px] transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{reportGenerated ? 'Report Downloaded!' : 'Export Coordination PDF'}</span>
            </button>
          </div>
        </div>

        {/* Main Content: Issues List on Left, Issue Details + Comments on Right */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Issues List */}
          <div className="w-80 border-r border-[var(--border-color)] bg-[var(--bg-surface)] flex flex-col overflow-y-auto">
            <div className="p-2 border-b border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Coordination Topics (BCF 2.1 / 3.0)
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              {issueList.map(issue => {
                const isSelected = activeIssue?.id === issue.id;
                return (
                  <div
                    key={issue.id}
                    onClick={() => {
                      setSelectedIssueId(issue.id);
                      handleRestoreViewpoint(issue);
                    }}
                    className={`p-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-cyan-950/40 border-l-2 border-cyan-400' : 'hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono font-bold text-cyan-400">{issue.id}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        issue.priority === 'Critical' ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-cyan-950 text-cyan-400'
                      }`}>
                        {issue.priority}
                      </span>
                    </div>

                    <div className="font-semibold text-[12px] text-[var(--text-primary)] leading-tight mb-1.5">
                      {issue.title}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                      <span>{issue.discipline}</span>
                      <span>{issue.comments.length} comments</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Issue Detail & Comments Thread */}
          {activeIssue && (
            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-elevated)] p-4">
              {/* Issue Header Info */}
              <div className="pb-3 border-b border-[var(--border-color)] flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-[13px] text-cyan-400">{activeIssue.id}:</span>
                    <span className="font-bold text-[14px] text-[var(--text-primary)]">{activeIssue.title}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1"><User className="w-3 h-3 text-cyan-400" /> {activeIssue.assignee}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-cyan-400" /> Due: {activeIssue.dueDate}</span>
                    <span className="font-semibold text-emerald-400">Status: {activeIssue.status}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleRestoreViewpoint(activeIssue)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-[11px] font-semibold"
                >
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Restore 3D Viewpoint</span>
                </button>
              </div>

              {/* Comments Thread Area */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3">
                {activeIssue.comments.map(c => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-cyan-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0 border border-cyan-600">
                      {c.avatar}
                    </div>
                    <div className="flex-1 bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-subtle)]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[11px] text-[var(--text-primary)]">{c.author}</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">{c.date}</span>
                      </div>
                      <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                        {c.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Comment Input */}
              <div className="pt-2 border-t border-[var(--border-color)] flex items-center gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                  placeholder="Type an engineering response or coordination note..."
                  className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg text-[12px] px-3 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleAddComment}
                  className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

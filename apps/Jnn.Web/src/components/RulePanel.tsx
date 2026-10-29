import { useState, useMemo } from 'react';
import {
  Play,
  Download,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  Search,
  Layers,
  Clock,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import { BUILTIN_RULES } from '../rules/builtinRules';
import { runRuleCheck } from '../rules/engine';
import type { RuleCheckResult, RuleViolation, RuleSeverity, RuleDefinition } from '../rules/types';
import { exportRuleReportHTML } from '../rules/ruleExport';
import { downloadFile } from '../clash/clashExport';
import { cn } from '../lib/cn';
import { useTranslation } from '../i18n';

export function RulePanel() {
  const { state, dispatch, viewer } = useApp();
  const { t, locale } = useTranslation();

  // Selected rule IDs (default all 5 enabled)
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(
    () => new Set(BUILTIN_RULES.map((r) => r.id)),
  );

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ percent: number } | null>(null);
  const [result, setResult] = useState<RuleCheckResult | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | RuleSeverity>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Toggle single rule
  const toggleRule = (ruleId: string) => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  // Toggle all rules
  const toggleAll = () => {
    if (selectedRuleIds.size === BUILTIN_RULES.length) {
      setSelectedRuleIds(new Set());
    } else {
      setSelectedRuleIds(new Set(BUILTIN_RULES.map((r) => r.id)));
    }
  };

  // Run Rule Checking
  const handleRunCheck = async () => {
    if (selectedRuleIds.size === 0 || isRunning) return;

    setIsRunning(true);
    setProgress({ percent: 0 });
    setSelectedIssueId(null);

    try {
      const elements = Array.from(state.byId.values());
      const enabledRules = BUILTIN_RULES.filter((r) => selectedRuleIds.has(r.id));

      const ctx = {
        models: [state.model],
        elements,
        getProperties: async (id: string) => state.byId.get(id)?.properties ?? [],
        clashResults: [],
      };

      const res = await runRuleCheck(enabledRules, ctx, (pct) => {
        setProgress({ percent: pct });
      });

      setResult(res);
    } catch (err) {
      console.error('[RulePanel] Error running rules:', err);
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  };

  // Export HTML Report
  const handleExportHTML = () => {
    if (!result) return;
    const modelName = state.model?.name || 'JNN BIM Model';
    const enabledRules = BUILTIN_RULES.filter((r) => selectedRuleIds.has(r.id));
    const totalChecked = state.byId.size;
    const html = exportRuleReportHTML(result, enabledRules, totalChecked, modelName, locale);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = locale === 'en' ? `Rule_Quality_Report_${dateStr}.html` : `Bao_cao_kiem_tra_quy_tac_${dateStr}.html`;
    downloadFile(html, filename, 'text/html;charset=utf-8');
  };

  // Highlight & Zoom into issue element
  const handleSelectIssue = (issue: RuleViolation, issueKey: string) => {
    setSelectedIssueId(issueKey);

    if (viewer) {
      const color = issue.severity === 'Error' ? '#ef4444' : '#f59e0b';
      if ('highlight' in viewer && typeof viewer.highlight === 'function') {
        viewer.highlight(new Map([[issue.elementId, color]]));
      }
      if ('fitToView' in viewer && typeof viewer.fitToView === 'function') {
        viewer.fitToView([issue.elementId]);
      }
    }

    dispatch({ type: 'select', ids: [issue.elementId], mode: 'replace' });
  };

  // All flattened issues
  const allIssues = useMemo(() => {
    if (!result) return [];
    const list: Array<{ issue: RuleViolation; key: string; rule: RuleDefinition }> = [];
    for (const rule of BUILTIN_RULES) {
      const issues = result.byRule.get(rule.id) || [];
      issues.forEach((issue, idx) => {
        list.push({
          issue,
          key: `${rule.id}-${issue.elementId}-${idx}`,
          rule,
        });
      });
    }
    return list;
  }, [result]);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    return allIssues.filter(({ issue, rule }) => {
      if (severityFilter !== 'ALL' && issue.severity !== severityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (issue.elementName ?? '').toLowerCase().includes(q);
        const matchId = issue.elementId.toLowerCase().includes(q);
        const matchRule = rule.name.toLowerCase().includes(q) || rule.id.toLowerCase().includes(q);
        const matchMsg = issue.message.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchRule && !matchMsg) {
          return false;
        }
      }
      return true;
    });
  }, [allIssues, severityFilter, searchQuery]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-surface text-ink" data-testid="rule-panel">
      {/* 1. Header Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3.5 py-2.5 bg-surface-1">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-accent" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink">{t('rules.title')}</h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="run-rules-btn"
            disabled={isRunning || selectedRuleIds.size === 0}
            onClick={handleRunCheck}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold shadow-sm transition-colors',
              isRunning || selectedRuleIds.size === 0
                ? 'bg-surface-3 text-muted cursor-not-allowed'
                : 'bg-accent text-white hover:bg-accent-hover active:scale-95',
            )}
          >
            <Play size={12} fill="currentColor" />
            <span>{isRunning ? t('rules.running') : t('rules.runAll')}</span>
          </button>

          <button
            type="button"
            data-testid="export-rules-html-btn"
            disabled={!result}
            onClick={handleExportHTML}
            title={t('rules.exportHtml')}
            className={cn(
              'flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium transition-colors',
              result
                ? 'bg-surface text-ink hover:bg-surface-2 active:scale-95'
                : 'bg-surface text-muted/50 border-line/50 cursor-not-allowed',
            )}
          >
            <Download size={12} />
            <span>{t('rules.exportHtml')}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar (when running) */}
      {isRunning && progress && (
        <div className="border-b border-line bg-surface-2 px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
            <span>{t('rules.checking')}</span>
            <span className="font-semibold tabular">{Math.round(progress.percent)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full bg-accent transition-all duration-150"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Scrollable Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
        {/* 2. Rules Selection Section */}
        <div className="rounded-lg border border-line bg-surface-1 p-2.5 shadow-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11.5px] font-bold uppercase tracking-wider text-muted">
              {t('rules.applicableRules', { count: selectedRuleIds.size, total: BUILTIN_RULES.length })}
            </span>
            <button
              type="button"
              data-testid="toggle-all-rules-btn"
              onClick={toggleAll}
              className="text-[11px] font-medium text-accent hover:underline"
            >
              {selectedRuleIds.size === BUILTIN_RULES.length ? t('rules.unselectAll') : t('rules.selectAll')}
            </button>
          </div>

          <div className="space-y-1.5">
            {BUILTIN_RULES.map((rule) => {
              const isChecked = selectedRuleIds.has(rule.id);
              return (
                <label
                  key={rule.id}
                  data-testid={`rule-item-${rule.id}`}
                  className={cn(
                    'flex items-start gap-2 rounded-md p-1.5 text-xs transition-colors cursor-pointer select-none',
                    isChecked ? 'bg-surface hover:bg-surface-2' : 'opacity-60 hover:opacity-90',
                  )}
                >
                  <input
                    type="checkbox"
                    data-testid={`rule-toggle-${rule.id}`}
                    checked={isChecked}
                    onChange={() => toggleRule(rule.id)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-line text-accent focus:ring-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-ink">{locale === 'en' ? rule.nameEn : rule.name}</span>
                      <span className="text-[10px] font-mono text-muted">({rule.id})</span>
                      <span
                        className={cn(
                          'ml-auto rounded px-1.5 py-0.2 text-[9.5px] font-bold uppercase',
                          rule.severity === 'Error'
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : rule.severity === 'Warning'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                        )}
                      >
                        {rule.severity}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted leading-tight">{rule.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* 3. Summary Stats (After run) */}
        {result && (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              <div className="rounded-md border border-line bg-surface-1 p-2 text-center">
                <div className="text-[10px] font-medium uppercase text-muted">{t('rules.totalViolations')}</div>
                <div
                  data-testid="stat-total-violations"
                  className={cn(
                    'text-base font-bold tabular',
                    result.totalViolations === 0 ? 'text-emerald-600' : 'text-red-500',
                  )}
                >
                  {result.totalViolations}
                </div>
              </div>

              <div className="rounded-md border border-red-500/20 bg-red-500/5 p-2 text-center">
                <div className="text-[10px] font-medium uppercase text-red-600 dark:text-red-400">{t('rules.errorLabel')}</div>
                <div data-testid="stat-errors" className="text-base font-bold text-red-600 tabular">
                  {result.bySeverity.Error}
                </div>
              </div>

              <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-center">
                <div className="text-[10px] font-medium uppercase text-amber-600 dark:text-amber-400">{t('rules.warningLabel')}</div>
                <div data-testid="stat-warnings" className="text-base font-bold text-amber-600 tabular">
                  {result.bySeverity.Warning}
                </div>
              </div>

              <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-2 text-center">
                <div className="text-[10px] font-medium uppercase text-blue-600 dark:text-blue-400">{t('rules.infoLabel')}</div>
                <div data-testid="stat-info" className="text-base font-bold text-blue-600 tabular">
                  {result.bySeverity.Info}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-1 text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <Clock size={11} />
                <span>{t('rules.duration', { ms: result.duration.toFixed(1) })}</span>
              </span>
              <span>{t('rules.elementsChecked', { count: state.byId.size })}</span>
            </div>
          </div>
        )}

        {/* 4. Violations Filter & List */}
        {result && (
          <div className="space-y-2">
            {/* Search & Filter Bar */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  data-testid="rule-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('rules.filterPlaceholder')}
                  className="w-full rounded-md border border-line bg-surface py-1 pl-7 pr-2 text-xs placeholder:text-muted/60 focus:border-accent focus:outline-none"
                />
              </div>

              <select
                data-testid="rule-severity-filter"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as any)}
                className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
              >
                <option value="ALL">{t('rules.allSeverityCount', { count: allIssues.length })}</option>
                <option value="Error">{t('rules.errorLabel')} ({result.bySeverity.Error})</option>
                <option value="Warning">{t('rules.warningLabel')} ({result.bySeverity.Warning})</option>
                <option value="Info">{t('rules.infoLabel')} ({result.bySeverity.Info})</option>
              </select>
            </div>

            {/* Issues List */}
            {filteredIssues.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line p-6 text-center">
                {result.totalViolations === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 text-emerald-600">
                    <CheckCircle size={28} />
                    <span className="text-xs font-semibold">{t('rules.noIssuesGreat')}</span>
                    <span className="text-[11px] text-muted">{t('rules.noIssuesCompliant')}</span>
                  </div>
                ) : (
                  <div className="text-xs text-muted">{t('rules.noIssuesFilter')}</div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-0.5">
                {filteredIssues.map(({ issue, key, rule }) => {
                  const isSelected = selectedIssueId === key;
                  return (
                    <div
                      key={key}
                      data-testid={`rule-issue-${key}`}
                      onClick={() => handleSelectIssue(issue, key)}
                      className={cn(
                        'flex items-start gap-2 rounded-lg border p-2 text-xs transition-all cursor-pointer',
                        isSelected
                          ? 'border-accent bg-accent/5 ring-1 ring-accent'
                          : 'border-line bg-surface hover:bg-surface-2',
                      )}
                    >
                      <div className="mt-0.5 shrink-0">
                        {issue.severity === 'Error' ? (
                          <AlertCircle size={14} className="text-red-500" />
                        ) : issue.severity === 'Warning' ? (
                          <AlertTriangle size={14} className="text-amber-500" />
                        ) : (
                          <Info size={14} className="text-blue-500" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-ink truncate">
                            {issue.elementName || t('rules.unnamedElement')}
                          </span>
                          <span className="font-mono text-[10px] text-muted shrink-0">
                            {rule.id}
                          </span>
                        </div>

                        <div className="font-mono text-[10.5px] text-accent/80 truncate">
                          {issue.elementId}
                        </div>

                        <p className="mt-1 text-[11px] text-muted leading-relaxed">
                          {locale === 'en' ? (issue.messageEn || issue.message) : issue.message}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

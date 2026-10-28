import type { RuleCheckResult, RuleDefinition, RuleViolation } from './types';

/**
 * Escapes HTML characters for safe embedding into HTML templates.
 */
function escapeHtml(str: string | undefined | null): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates a clean, standalone, zero-dependency HTML quality check report
 * for BIM models, complete with inline CSS/JS, instant filter/search, and print styling.
 */
export function exportRuleReportHTML(
  result: RuleCheckResult,
  rules: RuleDefinition[],
  totalChecked: number,
  modelName = 'Mô hình BIM',
): string {
  const generatedAt = new Date().toLocaleString('vi-VN', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const durationStr = `${result.duration.toFixed(1)} ms`;
  const totalViolations = result.totalViolations;
  const errorCount = result.bySeverity.Error;
  const warningCount = result.bySeverity.Warning;
  const infoCount = result.bySeverity.Info;

  // Group by rule rows
  const ruleSummaryRows = rules
    .map((r, idx) => {
      const issues = result.byRule.get(r.id) || [];
      const isPass = issues.length === 0;
      const statusBadge = isPass
        ? '<span class="badge badge-pass">✓ ĐẠT (PASS)</span>'
        : `<span class="badge badge-fail">⚠ ${issues.length} VI PHẠM</span>`;

      const sevBadge =
        r.severity === 'Error'
          ? '<span class="badge badge-error">Lỗi (Error)</span>'
          : r.severity === 'Warning'
            ? '<span class="badge badge-warning">Cảnh báo (Warning)</span>'
            : '<span class="badge badge-info">Thông tin (Info)</span>';

      return `
        <tr>
          <td style="text-align: center; font-weight: 500;">${idx + 1}</td>
          <td><code>${escapeHtml(r.id)}</code></td>
          <td style="font-weight: 600;">${escapeHtml(r.name)}</td>
          <td>${sevBadge}</td>
          <td>${statusBadge}</td>
          <td style="text-align: right; font-weight: 600;">${issues.length}</td>
        </tr>
      `;
    })
    .join('');

  // Flatten all issues for table
  const allIssues: Array<{ issue: RuleViolation; ruleName: string }> = [];
  for (const r of rules) {
    const list = result.byRule.get(r.id) || [];
    for (const item of list) {
      allIssues.push({ issue: item, ruleName: r.name });
    }
  }

  // Detailed issue rows
  const issueRows = allIssues
    .map(({ issue, ruleName }, idx) => {
      const sevClass =
        issue.severity === 'Error'
          ? 'badge-error'
          : issue.severity === 'Warning'
            ? 'badge-warning'
            : 'badge-info';

      const sevText =
        issue.severity === 'Error'
          ? 'Lỗi'
          : issue.severity === 'Warning'
            ? 'Cảnh báo'
            : 'Thông tin';

      return `
        <tr data-severity="${escapeHtml(issue.severity)}" data-search="${escapeHtml(
          `${issue.ruleId} ${ruleName} ${issue.elementName ?? ''} ${issue.elementId} ${issue.message}`,
        ).toLowerCase()}">
          <td style="text-align: center; font-weight: 500;">${idx + 1}</td>
          <td><code>${escapeHtml(issue.ruleId)}</code></td>
          <td style="font-weight: 500;">${escapeHtml(ruleName)}</td>
          <td><span class="badge ${sevClass}">${sevText}</span></td>
          <td style="font-family: monospace; font-size: 12px; color: #0284c7;">${escapeHtml(issue.elementId)}</td>
          <td style="font-weight: 500;">${escapeHtml(issue.elementName || '(Không tên)')}</td>
          <td style="color: #334155;">${escapeHtml(issue.message)}</td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo cáo Kiểm tra Quy tắc Mô hình BIM - ${escapeHtml(modelName)}</title>
  <style>
    :root {
      --primary: #0284c7;
      --primary-dark: #0369a1;
      --surface: #ffffff;
      --background: #f8fafc;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --error: #ef4444;
      --error-bg: #fef2f2;
      --warning: #f59e0b;
      --warning-bg: #fffbeb;
      --success: #10b981;
      --success-bg: #ecfdf5;
      --info: #3b82f6;
      --info-bg: #eff6ff;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--background);
      color: var(--text);
      line-height: 1.5;
      padding: 32px 24px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px 32px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 16px;
    }

    .header-info h1 {
      font-size: 24px;
      font-weight: 700;
      color: #0369a1;
      margin-bottom: 8px;
    }

    .header-info p {
      color: var(--text-muted);
      font-size: 14px;
    }

    .actions {
      display: flex;
      gap: 12px;
    }

    .btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: var(--primary);
      color: white;
    }
    .btn-primary:hover { background: var(--primary-dark); }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px 20px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }

    .stat-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 4px;
    }

    .stat-value {
      font-size: 26px;
      font-weight: 700;
    }

    .stat-value.error { color: var(--error); }
    .stat-value.warning { color: var(--warning); }
    .stat-value.info { color: var(--info); }
    .stat-value.success { color: var(--success); }

    .section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .section-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .controls-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .search-input {
      flex: 1;
      min-width: 250px;
      padding: 8px 14px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--primary);
    }

    .filter-select {
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 13px;
      background: white;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      text-align: left;
    }

    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 600;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
    }

    td {
      padding: 10px 14px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }

    tr:hover td {
      background-color: #f8fafc;
    }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }

    .badge-pass { background: var(--success-bg); color: #047857; }
    .badge-fail { background: var(--error-bg); color: #b91c1c; }
    .badge-error { background: var(--error-bg); color: var(--error); border: 1px solid #fecaca; }
    .badge-warning { background: var(--warning-bg); color: #b45309; border: 1px solid #fde68a; }
    .badge-info { background: var(--info-bg); color: var(--info); border: 1px solid #bfdbfe; }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      background: #f1f5f9;
      padding: 2px 5px;
      border-radius: 4px;
    }

    @media print {
      body { background: white; padding: 0; }
      .container { max-width: 100%; }
      header, .section, .stat-card { box-shadow: none; border-color: #cbd5e1; }
      .actions, .controls-bar { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-info">
        <h1>Báo cáo Kiểm tra Chất lượng Mô hình BIM</h1>
        <p><strong>Mô hình:</strong> ${escapeHtml(modelName)} | <strong>Ngày tạo:</strong> ${generatedAt} | <strong>Thời gian chạy:</strong> ${durationStr}</p>
      </div>
      <div class="actions">
        <button class="btn btn-primary" onclick="window.print()">In / Xuất PDF</button>
      </div>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Tổng cấu kiện đã duyệt</div>
        <div class="stat-value">${totalChecked.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Tổng số vi phạm</div>
        <div class="stat-value ${totalViolations === 0 ? 'success' : 'error'}">${totalViolations}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Lỗi nghiêm trọng (Error)</div>
        <div class="stat-value error">${errorCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cảnh báo (Warning)</div>
        <div class="stat-value warning">${warningCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Thông tin (Info)</div>
        <div class="stat-value info">${infoCount}</div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">1. Tổng hợp theo Quy tắc Kiểm tra</h2>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">STT</th>
              <th style="width: 120px;">Mã Quy tắc</th>
              <th>Tên Quy tắc</th>
              <th style="width: 130px;">Mức độ</th>
              <th style="width: 140px;">Kết quả</th>
              <th style="width: 100px; text-align: right;">Số vi phạm</th>
            </tr>
          </thead>
          <tbody>
            ${ruleSummaryRows}
          </tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">2. Danh sách Chi tiết Vi phạm (${allIssues.length})</h2>
      <div class="controls-bar">
        <input type="text" id="searchInput" class="search-input" placeholder="Tìm theo tên phần tử, ID, mã quy tắc hoặc mô tả..." oninput="applyFilters()">
        <select id="severityFilter" class="filter-select" onchange="applyFilters()">
          <option value="ALL">Tất cả mức độ</option>
          <option value="Error">Chỉ Lỗi (Error)</option>
          <option value="Warning">Chỉ Cảnh báo (Warning)</option>
          <option value="Info">Chỉ Thông tin (Info)</option>
        </select>
      </div>

      <div style="overflow-x: auto;">
        <table id="issuesTable">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">STT</th>
              <th style="width: 110px;">Mã QT</th>
              <th style="width: 180px;">Tên Quy tắc</th>
              <th style="width: 100px;">Mức độ</th>
              <th style="width: 160px;">Element ID</th>
              <th style="width: 200px;">Tên phần tử</th>
              <th>Mô tả chi tiết vi phạm</th>
            </tr>
          </thead>
          <tbody>
            ${issueRows.length > 0 ? issueRows : '<tr><td colspan="7" style="text-align: center; padding: 24px; color: #10b981; font-weight: 600;">✓ Tuyệt vời! Không phát hiện vi phạm nào trong mô hình.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    function applyFilters() {
      const query = (document.getElementById('searchInput').value || '').toLowerCase().trim();
      const severity = document.getElementById('severityFilter').value;
      const rows = document.querySelectorAll('#issuesTable tbody tr[data-severity]');

      rows.forEach(function(row) {
        const rowSeverity = row.getAttribute('data-severity');
        const searchContent = row.getAttribute('data-search') || '';

        const matchSev = (severity === 'ALL' || rowSeverity === severity);
        const matchSearch = (!query || searchContent.includes(query));

        if (matchSev && matchSearch) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>`;
}

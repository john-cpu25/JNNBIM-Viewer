import { describe, it, expect } from 'vitest';
import { exportRuleReportHTML } from './ruleExport';
import { BUILTIN_RULES } from './builtinRules';
import type { RuleCheckResult } from './types';

describe('ruleExport - HTML report generation', () => {
  const mockViolations = [
    {
      ruleId: 'R-GEO-01',
      severity: 'Error' as const,
      elementId: 'el-1',
      elementName: 'Wall 101',
      globalId: 'guid-101',
      modelId: 'm1',
      message: 'Thiếu hình học',
      messageEn: 'Missing geometry',
    },
    {
      ruleId: 'R-NAM-01',
      severity: 'Warning' as const,
      elementId: 'el-2',
      elementName: 'Generic Column',
      globalId: 'guid-102',
      modelId: 'm1',
      message: 'Tên mặc định',
      messageEn: 'Default name',
    },
  ];

  const mockResult: RuleCheckResult = {
    totalViolations: 2,
    byRule: new Map([
      ['R-GEO-01', [mockViolations[0]!]],
      ['R-NAM-01', [mockViolations[1]!]],
    ]),
    bySeverity: {
      Error: 1,
      Warning: 1,
      Info: 0,
    },
    duration: 12.5,
  };

  it('generates a valid, self-contained HTML report with embedded JNN base64 logo', () => {
    const html = exportRuleReportHTML(mockResult, BUILTIN_RULES, 100, 'Test Building', 'vi');

    // 1. Structure checks
    expect(html.trim().startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html.includes('</html>')).toBe(true);
    expect(html.includes('<style>')).toBe(true);
    expect(html.includes('<script>')).toBe(true);
    expect(html.includes('<script src=')).toBe(false);
    expect(html.includes('<link rel="stylesheet"')).toBe(false);

    // 2. DOM parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Header & Logo
    const logoImg = doc.querySelector('.header-logo img') as HTMLImageElement;
    expect(logoImg).not.toBeNull();
    expect(logoImg.src.startsWith('data:image/png;base64,')).toBe(true);
    expect(logoImg.alt).toBe('JNN');

    // Title & info
    expect(doc.querySelector('h1')?.textContent).toContain('Báo cáo Kiểm tra Chất lượng');
    expect(doc.querySelector('.header-info p')?.textContent).toContain('Test Building');

    // Stats
    const statValues = Array.from(doc.querySelectorAll('.stat-value')).map((el) => el.textContent?.trim());
    expect(statValues).toContain('100'); // total checked
    expect(statValues).toContain('2'); // total violations

    // Table rows
    const rows = doc.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { runRuleCheck } from './engine';
import type { RuleDefinition, RuleContext, RuleViolation } from './types';

describe('Rule Engine Framework (T17.1)', () => {
  const dummyContext: RuleContext = {
    models: [],
    elements: [],
    getProperties: async () => [],
    clashResults: [],
  };

  it('aggregates violations correctly when a rule returns violations', async () => {
    const mockViolations: RuleViolation[] = [
      {
        ruleId: 'RULE-1',
        severity: 'Error',
        elementId: 'el-1',
        elementName: 'Wall 1',
        globalId: 'guid-1',
        modelId: 'm1',
        message: 'Lỗi hình học',
        messageEn: 'Geometry error',
      },
      {
        ruleId: 'RULE-1',
        severity: 'Error',
        elementId: 'el-2',
        elementName: 'Wall 2',
        globalId: 'guid-2',
        modelId: 'm1',
        message: 'Lỗi hình học 2',
        messageEn: 'Geometry error 2',
      },
      {
        ruleId: 'RULE-1',
        severity: 'Warning',
        elementId: 'el-3',
        elementName: 'Beam 3',
        globalId: 'guid-3',
        modelId: 'm1',
        message: 'Cảnh báo tên',
        messageEn: 'Naming warning',
      },
    ];

    const rule1: RuleDefinition = {
      id: 'RULE-1',
      name: 'Kiểm tra lỗi',
      nameEn: 'Error check',
      description: 'Mô tả rule 1',
      category: 'Geometry',
      severity: 'Error',
      check: async () => mockViolations,
    };

    const result = await runRuleCheck([rule1], dummyContext);

    expect(result.totalViolations).toBe(3);
    expect(result.byRule.get('RULE-1')).toHaveLength(3);
    expect(result.bySeverity.Error).toBe(2);
    expect(result.bySeverity.Warning).toBe(1);
    expect(result.bySeverity.Info).toBe(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.ruleErrors).toBeUndefined();
  });

  it('handles empty violations gracefully (rule returns [])', async () => {
    const cleanRule: RuleDefinition = {
      id: 'RULE-CLEAN',
      name: 'Quy tắc sạch',
      nameEn: 'Clean rule',
      description: 'Không có lỗi',
      category: 'Naming',
      severity: 'Info',
      check: async () => [],
    };

    const result = await runRuleCheck([cleanRule], dummyContext);

    expect(result.totalViolations).toBe(0);
    expect(result.byRule.get('RULE-CLEAN')).toEqual([]);
    expect(result.bySeverity.Error).toBe(0);
    expect(result.bySeverity.Warning).toBe(0);
    expect(result.bySeverity.Info).toBe(0);
  });

  it('catches rule errors, logs error info, and continues executing subsequent rules', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const failingRule: RuleDefinition = {
      id: 'RULE-FAIL',
      name: 'Quy tắc lỗi bất ngờ',
      nameEn: 'Failing rule',
      description: 'Throw error',
      category: 'Property',
      severity: 'Error',
      check: async () => {
        throw new Error('Database connection failed');
      },
    };

    const successRule: RuleDefinition = {
      id: 'RULE-SUCCESS',
      name: 'Quy tắc kế tiếp',
      nameEn: 'Success rule',
      description: 'Chạy bình thường',
      category: 'Spatial',
      severity: 'Warning',
      check: async () => [
        {
          ruleId: 'RULE-SUCCESS',
          severity: 'Warning',
          elementId: 'el-10',
          elementName: 'Column 10',
          modelId: 'm1',
          message: 'Không có tầng',
          messageEn: 'No storey',
        },
      ],
    };

    const progressReports: number[] = [];
    const result = await runRuleCheck(
      [failingRule, successRule],
      dummyContext,
      (p) => progressReports.push(p),
    );

    expect(result.totalViolations).toBe(1);
    expect(result.byRule.get('RULE-FAIL')).toEqual([]);
    expect(result.byRule.get('RULE-SUCCESS')).toHaveLength(1);
    expect(result.ruleErrors).toHaveLength(1);
    expect(result.ruleErrors![0]!.ruleId).toBe('RULE-FAIL');
    expect(result.ruleErrors![0]!.error).toBe('Database connection failed');

    // Progress updates called: 50% and 100%
    expect(progressReports).toEqual([50, 100]);

    consoleErrorSpy.mockRestore();
  });
});

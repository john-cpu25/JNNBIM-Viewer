import type {
  RuleDefinition,
  RuleContext,
  RuleCheckResult,
  RuleViolation,
} from './types';

/**
 * Executes a list of rules sequentially against the given RuleContext,
 * aggregates all violations by rule and by severity, catches errors per rule,
 * and reports progress.
 */
export async function runRuleCheck(
  rules: RuleDefinition[],
  ctx: RuleContext,
  onProgress?: (progressPercent: number) => void,
): Promise<RuleCheckResult> {
  const startTime = performance.now();
  const byRule = new Map<string, RuleViolation[]>();
  const bySeverity = {
    Error: 0,
    Warning: 0,
    Info: 0,
  };
  const ruleErrors: Array<{ ruleId: string; error: string }> = [];
  let totalViolations = 0;

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]!;
    try {
      const violations = await rule.check(ctx);
      byRule.set(rule.id, violations);
      totalViolations += violations.length;

      for (const v of violations) {
        if (v.severity in bySeverity) {
          bySeverity[v.severity]++;
        }
      }
    } catch (err) {
      console.error(`[RuleEngine] Quy tắc ${rule.id} gặp lỗi:`, err);
      ruleErrors.push({
        ruleId: rule.id,
        error: (err as Error).message || String(err),
      });
      byRule.set(rule.id, []);
    }

    if (onProgress) {
      onProgress(Math.round(((i + 1) / rules.length) * 100));
    }
  }

  const duration = performance.now() - startTime;

  return {
    totalViolations,
    byRule,
    bySeverity,
    duration,
    ruleErrors: ruleErrors.length > 0 ? ruleErrors : undefined,
  };
}

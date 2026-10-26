import type { Check, CheckResult, LlmJudgeCheck, RuleCheck } from '../schemas/checks';
import { validateJsonOutput } from './json-schema';
import { detectRefusal } from './refusal';
import { safeRegexTest } from './regex';

export interface CheckContext {
  output: string;
  latencyMs: number;
}

const preview = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max)}…` : text);

function includes(output: string, value: string, caseSensitive = false): boolean {
  return caseSensitive ? output.includes(value) : output.toLowerCase().includes(value.toLowerCase());
}

function result(type: CheckResult['type'], passed: boolean, message: string): CheckResult {
  return { type, passed, message };
}

export function evaluateRuleCheck(check: RuleCheck, ctx: CheckContext): CheckResult {
  const { output, latencyMs } = ctx;
  switch (check.type) {
    case 'contains': {
      const passed = includes(output, check.value, check.caseSensitive);
      return result(
        check.type,
        passed,
        passed ? `Contains "${preview(check.value)}"` : `Missing "${preview(check.value)}"`,
      );
    }
    case 'not_contains': {
      const passed = !includes(output, check.value, check.caseSensitive);
      return result(
        check.type,
        passed,
        passed
          ? `Does not contain "${preview(check.value)}"`
          : `Contains forbidden "${preview(check.value)}"`,
      );
    }
    case 'equals': {
      const passed = output.trim() === check.value.trim();
      return result(check.type, passed, passed ? 'Exact match' : `Expected "${preview(check.value.trim())}"`);
    }
    case 'regex': {
      const tested = safeRegexTest(check.pattern, check.flags, output);
      if (!tested.ok) return result(check.type, false, tested.error);
      return result(
        check.type,
        tested.matched === true,
        tested.matched ? `Matches /${preview(check.pattern)}/` : `Does not match /${preview(check.pattern)}/`,
      );
    }
    case 'json_schema': {
      const validation = validateJsonOutput(output, check.schema);
      return result(
        check.type,
        validation.valid,
        validation.valid ? 'Valid JSON matching the schema' : validation.error,
      );
    }
    case 'max_length': {
      const passed = output.length <= check.chars;
      return result(check.type, passed, `${output.length} / ${check.chars} characters`);
    }
    case 'latency': {
      const passed = latencyMs <= check.maxMs;
      return result(check.type, passed, `${latencyMs} ms (limit ${check.maxMs} ms)`);
    }
    case 'refusal': {
      const refused = detectRefusal(output);
      const passed = refused === check.expected;
      const actual = refused ? 'Refused' : 'Did not refuse';
      return result(check.type, passed, `${actual} (expected ${check.expected ? 'a refusal' : 'an answer'})`);
    }
  }
}

export function isJudgeCheck(check: Check): check is LlmJudgeCheck {
  return check.type === 'llm_judge';
}

/**
 * Evaluates every rule check and returns the `llm_judge` checks separately: those need a
 * model call (or the mock judge) and are evaluated by the worker.
 */
export function evaluateRuleChecks(
  checks: readonly Check[],
  ctx: CheckContext,
): { results: CheckResult[]; judgeChecks: LlmJudgeCheck[] } {
  const results: CheckResult[] = [];
  const judgeChecks: LlmJudgeCheck[] = [];
  for (const check of checks) {
    if (isJudgeCheck(check)) judgeChecks.push(check);
    else results.push(evaluateRuleCheck(check, ctx));
  }
  return { results, judgeChecks };
}

export function judgeCheckResult(
  check: LlmJudgeCheck,
  verdict: { score: number; reason: string },
  mode: 'mock' | 'live',
): CheckResult {
  const passed = verdict.score >= check.threshold;
  return {
    type: 'llm_judge',
    passed,
    score: verdict.score,
    mode,
    message: `Score ${verdict.score}/10 (needs ${check.threshold}). ${verdict.reason}`,
  };
}

export function allChecksPassed(results: readonly CheckResult[]): boolean {
  return results.length > 0 && results.every((check) => check.passed);
}

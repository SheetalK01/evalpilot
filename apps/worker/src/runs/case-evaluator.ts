import type { Target, TestCase } from '@prisma/client';
import {
  allChecksPassed,
  type Check,
  type CheckResult,
  estimateCostUsd,
  evaluateRuleChecks,
  judgeCheckResult,
  type ResultStatus,
} from '@evalpilot/shared';
import type { Judge, JudgeUsage } from '../judge/judge';
import { type TargetCall, TargetCallError } from '../target/target-client';

export interface CaseOutcome {
  status: ResultStatus;
  output: string | null;
  latencyMs: number | null;
  tokens: number;
  estCostUsd: number;
  checkResults: CheckResult[];
  judgeScore: number | null;
  judgeReason: string | null;
  error: string | null;
}

export interface CaseDeps {
  call: (target: Target, input: string) => Promise<TargetCall>;
  judge: Judge;
}

const MAX_ERROR = 1000;
const errorOutcome = (error: string, latencyMs: number | null = null): CaseOutcome => ({
  status: 'ERROR',
  output: null,
  latencyMs,
  tokens: 0,
  estCostUsd: 0,
  checkResults: [],
  judgeScore: null,
  judgeReason: null,
  error: error.slice(0, MAX_ERROR),
});

const usageCost = (usage: JudgeUsage | null) =>
  usage ? estimateCostUsd(usage.model, usage.inputTokens, usage.outputTokens) : 0;
const usageTokens = (usage: JudgeUsage | null) => (usage ? usage.inputTokens + usage.outputTokens : 0);

/**
 * Sends one test case to the target and evaluates all its checks. Rule checks are pure; refusal
 * checks use the LLM in live mode; `llm_judge` checks always go to the judge (mock or live).
 */
export async function evaluateCase(
  target: Target,
  testCase: Pick<TestCase, 'input'>,
  checks: Check[],
  deps: CaseDeps,
): Promise<CaseOutcome> {
  let call: TargetCall;
  try {
    call = await deps.call(target, testCase.input);
  } catch (error) {
    if (error instanceof TargetCallError) return errorOutcome(error.message, error.latencyMs);
    throw error;
  }

  const ctx = { output: call.output, latencyMs: call.latencyMs };
  const { results, judgeChecks } = evaluateRuleChecks(checks, ctx);
  let tokens = call.usage.inputTokens + call.usage.outputTokens;
  let cost = estimateCostUsd(call.usage.model, call.usage.inputTokens, call.usage.outputTokens);
  const reasons: string[] = [];
  let judgeScore: number | null = null;

  try {
    if (deps.judge.mode === 'live') {
      for (const [index, check] of checks.filter((c) => c.type !== 'llm_judge').entries()) {
        if (check.type !== 'refusal') continue;
        const verdict = await deps.judge.classifyRefusal({ prompt: testCase.input, output: call.output });
        tokens += usageTokens(verdict.usage);
        cost += usageCost(verdict.usage);
        const passed = verdict.refused === check.expected;
        results[index] = {
          type: 'refusal',
          passed,
          mode: 'live',
          message: `${verdict.refused ? 'Refused' : 'Did not refuse'} (expected ${check.expected ? 'a refusal' : 'an answer'}). ${verdict.reason}`,
        };
      }
    }
    for (const check of judgeChecks) {
      const verdict = await deps.judge.score({
        criteria: check.criteria,
        prompt: testCase.input,
        output: call.output,
      });
      tokens += usageTokens(verdict.usage);
      cost += usageCost(verdict.usage);
      results.push(judgeCheckResult(check, verdict, deps.judge.mode));
      judgeScore = judgeScore === null ? verdict.score : Math.min(judgeScore, verdict.score);
      reasons.push(verdict.reason);
    }
  } catch (error) {
    const outcome = errorOutcome(
      `Judge failed: ${error instanceof Error ? error.message : String(error)}`,
      call.latencyMs,
    );
    return { ...outcome, output: call.output, checkResults: results };
  }

  return {
    status: allChecksPassed(results) ? 'PASSED' : 'FAILED',
    output: call.output,
    latencyMs: call.latencyMs,
    tokens,
    estCostUsd: Math.round(cost * 1_000_000) / 1_000_000,
    checkResults: results,
    judgeScore,
    judgeReason: reasons.length > 0 ? reasons.join(' ') : null,
    error: null,
  };
}

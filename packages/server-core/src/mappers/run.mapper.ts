import type { Prisma, TestResult, TestRun } from '@prisma/client';
import {
  type CheckResult,
  checkResultSchema,
  type RunResponse,
  type TestResultResponse,
} from '@evalpilot/shared';

/** Include this when loading a run, so `toRunResponse` has the suite fields it needs. */
export const RUN_INCLUDE = {
  suite: { select: { name: true, projectId: true, passThreshold: true } },
} satisfies Prisma.TestRunInclude;

export type RunWithSuite = TestRun & { suite: { name: string; projectId: string; passThreshold: number } };

const iso = (date: Date | null) => date?.toISOString() ?? null;

export function toRunResponse(run: RunWithSuite): RunResponse {
  return {
    id: run.id,
    suiteId: run.suiteId,
    suiteName: run.suite.name,
    projectId: run.suite.projectId,
    status: run.status,
    trigger: run.trigger,
    commitSha: run.commitSha,
    total: run.total,
    passed: run.passed,
    failed: run.failed,
    passRate: run.passRate,
    passThreshold: run.suite.passThreshold,
    avgLatencyMs: run.avgLatencyMs,
    totalTokens: run.totalTokens,
    estCostUsd: run.estCostUsd.toNumber(),
    startedAt: iso(run.startedAt),
    finishedAt: iso(run.finishedAt),
    error: run.error,
    createdAt: run.createdAt.toISOString(),
  };
}

export function parseCheckResults(value: unknown): CheckResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = checkResultSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export function toTestResultResponse(result: TestResult): TestResultResponse {
  return {
    id: result.id,
    runId: result.runId,
    testCaseId: result.testCaseId,
    caseName: result.caseName,
    position: result.position,
    status: result.status,
    output: result.output,
    latencyMs: result.latencyMs,
    tokens: result.tokens,
    estCostUsd: result.estCostUsd.toNumber(),
    checkResults: parseCheckResults(result.checkResultsJson),
    judgeScore: result.judgeScore,
    judgeReason: result.judgeReason,
    error: result.error,
    createdAt: result.createdAt.toISOString(),
  };
}

/** "PPFE…" in suite order: one letter per result, for the compact flight strip in run lists. */
export function resultStrip(results: readonly Pick<TestResult, 'status' | 'position'>[]): string {
  const letter = { PASSED: 'P', FAILED: 'F', ERROR: 'E' } as const;
  return [...results]
    .sort((a, b) => a.position - b.position)
    .map((result) => letter[result.status])
    .join('');
}

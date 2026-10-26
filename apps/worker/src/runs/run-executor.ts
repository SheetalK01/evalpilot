import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma, Target, TestCase } from '@prisma/client';
import {
  checksSchema,
  FINAL_RUN_STATUSES,
  REALTIME_EVENTS,
  runVerdict,
  summarizeResults,
} from '@evalpilot/shared';
import {
  PrismaService,
  RealtimePublisher,
  RUN_INCLUDE,
  toRunResponse,
  toTestResultResponse,
} from '@evalpilot/server-core';
import { forEachConcurrent } from '../concurrency';
import { SerialQueue } from '../serial';
import { type Judge, JUDGE } from '../judge/judge';
import { TargetClient } from '../target/target-client';
import { type CaseOutcome, evaluateCase } from './case-evaluator';

/** Test cases of one run that are sent to the target at the same time. */
export const CASE_CONCURRENCY = 4;

const parseChecks = (value: unknown) => {
  const parsed = checksSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
};

/** Executes one test run end to end. Safe to call twice for the same run (results are upserted). */
@Injectable()
export class RunExecutor {
  private readonly logger = new Logger(RunExecutor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly targets: TargetClient,
    private readonly realtime: RealtimePublisher,
    @Inject(JUDGE) private readonly judge: Judge,
  ) {}

  async execute(runId: string): Promise<void> {
    try {
      await this.process(runId);
    } catch (error) {
      this.logger.error({ err: error, runId }, 'Run failed');
      await this.finish(runId, { error: error instanceof Error ? error.message : 'Unexpected error' });
    }
  }

  private async process(runId: string): Promise<void> {
    const run = await this.prisma.testRun.findUnique({
      where: { id: runId },
      include: {
        suite: { include: { target: true, cases: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } } },
      },
    });
    if (!run || FINAL_RUN_STATUSES.includes(run.status)) return;
    const { target, cases } = run.suite;
    if (!target) {
      await this.finish(runId, { error: 'The suite has no target' });
      return;
    }

    const done = await this.prisma.testResult.findMany({ where: { runId }, select: { testCaseId: true } });
    const doneIds = new Set(done.map((result) => result.testCaseId));
    await this.prisma.testRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt: run.startedAt ?? new Date(), total: cases.length },
    });

    let finished = done.length;
    const total = cases.length;
    const events = new SerialQueue();
    await this.publishProgress(runId, finished, total);

    const pending = cases
      .map((testCase, position) => ({ testCase, position }))
      .filter(({ testCase }) => !doneIds.has(testCase.id));
    await forEachConcurrent(pending, CASE_CONCURRENCY, async ({ testCase, position }) => {
      if (await this.isCancelled(runId)) return;
      const outcome = await evaluateCase(target, testCase, parseChecks(testCase.checksJson), {
        call: (t: Target, input: string) => this.targets.call(t, input),
        judge: this.judge,
      });
      const saved = await this.saveResult(runId, testCase, position, outcome);
      await events.run(async () => {
        finished += 1;
        await this.realtime.publish('run', runId, REALTIME_EVENTS.resultCreated, {
          result: toTestResultResponse(saved),
        });
        await this.publishProgress(runId, finished, total);
      });
    });

    await this.finish(runId, {});
  }

  private async isCancelled(runId: string): Promise<boolean> {
    const current = await this.prisma.testRun.findUnique({ where: { id: runId }, select: { status: true } });
    return current?.status === 'CANCELLED';
  }

  /** Upsert on (run, case): a retried job overwrites instead of duplicating. */
  private saveResult(runId: string, testCase: TestCase, position: number, outcome: CaseOutcome) {
    const data = {
      caseName: testCase.name,
      position,
      status: outcome.status,
      output: outcome.output,
      latencyMs: outcome.latencyMs,
      tokens: outcome.tokens,
      estCostUsd: outcome.estCostUsd,
      error: outcome.error,
      checkResultsJson: outcome.checkResults as unknown as Prisma.InputJsonValue,
      judgeScore: outcome.judgeScore,
      judgeReason: outcome.judgeReason,
    };
    return this.prisma.testResult.upsert({
      where: { runId_testCaseId: { runId, testCaseId: testCase.id } },
      create: { runId, testCaseId: testCase.id, ...data },
      update: data,
    });
  }

  private publishProgress(runId: string, done: number, total: number): Promise<void> {
    return this.realtime.publish('run', runId, REALTIME_EVENTS.runProgress, {
      runId,
      done,
      total,
    });
  }

  /** Writes the summary and final status (PASSED/FAILED by threshold, CANCELLED, or ERROR). */
  private async finish(runId: string, { error }: { error?: string }): Promise<void> {
    const run = await this.prisma.testRun.findUnique({ where: { id: runId }, include: RUN_INCLUDE });
    if (!run) return;
    const results = await this.prisma.testResult.findMany({
      where: { runId },
      select: { status: true, latencyMs: true, tokens: true, estCostUsd: true },
    });
    const summary = summarizeResults(results);
    const status = error
      ? 'ERROR'
      : run.status === 'CANCELLED'
        ? 'CANCELLED'
        : runVerdict(summary.passRate, run.suite.passThreshold);
    const updated = await this.prisma.testRun.update({
      where: { id: runId },
      data: {
        status,
        error: error?.slice(0, 1000) ?? null,
        passed: summary.passed,
        failed: summary.failed,
        passRate: summary.passRate,
        avgLatencyMs: summary.avgLatencyMs,
        totalTokens: summary.totalTokens,
        estCostUsd: results.reduce((sum, result) => sum + result.estCostUsd.toNumber(), 0),
        finishedAt: new Date(),
      },
      include: RUN_INCLUDE,
    });
    await this.realtime.publish('run', runId, REALTIME_EVENTS.runCompleted, {
      run: toRunResponse(updated),
    });
  }
}

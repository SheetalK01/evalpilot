import { Injectable } from '@nestjs/common';
import { type DashboardResponse, percentile } from '@evalpilot/shared';
import {
  PrismaService,
  REDTEAM_RUN_INCLUDE,
  RUN_INCLUDE,
  toRedteamRunResponse,
} from '@evalpilot/server-core';
import { NEWEST_FIRST } from '../common/pagination';
import { RunsService } from '../runs/runs.service';

const DAY = 24 * 60 * 60 * 1000;
export const TREND_DAYS = 14;
const TREND_RUNS = 30;
const RECENT_RUNS = 8;

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/** The last `days` UTC dates, oldest first, as YYYY-MM-DD. */
export function lastDays(now: Date, days: number): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, i) => dayKey(new Date(today - (days - 1 - i) * DAY)));
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runs: RunsService,
  ) {}

  async get(ownerId: string, now = new Date()): Promise<DashboardResponse> {
    const owned = { project: { ownerId } };
    const days = lastDays(now, TREND_DAYS);
    const since = new Date(`${days[0] ?? dayKey(now)}T00:00:00.000Z`);

    const [projects, suites, runs, traces24h, trendRuns, latestRedteam, costRuns, costTraces, recent] =
      await Promise.all([
        this.prisma.project.count({ where: { ownerId } }),
        this.prisma.testSuite.count({ where: owned }),
        this.prisma.testRun.count({ where: { suite: owned } }),
        this.prisma.trace.count({ where: { ...owned, startedAt: { gte: new Date(now.getTime() - DAY) } } }),
        this.prisma.testRun.findMany({
          where: { suite: owned, status: { in: ['PASSED', 'FAILED'] }, passRate: { not: null } },
          orderBy: NEWEST_FIRST,
          take: TREND_RUNS,
          include: RUN_INCLUDE,
        }),
        this.prisma.redteamRun.findFirst({
          where: { ...owned, status: 'COMPLETED' },
          orderBy: NEWEST_FIRST,
          include: REDTEAM_RUN_INCLUDE,
        }),
        this.prisma.testRun.findMany({
          where: { suite: owned, finishedAt: { gte: since } },
          select: { finishedAt: true, estCostUsd: true },
        }),
        this.prisma.trace.findMany({
          where: { ...owned, startedAt: { gte: since } },
          select: { startedAt: true, estCostUsd: true, latencyMs: true },
        }),
        this.prisma.testRun.findMany({
          where: { suite: owned },
          orderBy: NEWEST_FIRST,
          take: RECENT_RUNS,
          include: RUN_INCLUDE,
        }),
      ]);

    return {
      counts: { projects, suites, runs, traces24h },
      passRateTrend: trendRuns.reverse().map((run) => ({
        runId: run.id,
        suiteName: run.suite.name,
        passRate: run.passRate ?? 0,
        createdAt: run.createdAt.toISOString(),
      })),
      latestRedteam: latestRedteam ? toRedteamRunResponse(latestRedteam) : null,
      costTrend: days.map((date) => {
        const runsOfDay = costRuns.filter((run) => run.finishedAt && dayKey(run.finishedAt) === date);
        const tracesOfDay = costTraces.filter((trace) => dayKey(trace.startedAt) === date);
        const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
        return {
          date,
          runsCostUsd: round(runsOfDay.reduce((sum, run) => sum + run.estCostUsd.toNumber(), 0)),
          tracesCostUsd: round(tracesOfDay.reduce((sum, trace) => sum + trace.estCostUsd.toNumber(), 0)),
          p95LatencyMs: percentile(
            tracesOfDay.map((trace) => trace.latencyMs),
            95,
          ),
        };
      }),
      recentRuns: await this.runs.withStrips(recent),
    };
  }
}

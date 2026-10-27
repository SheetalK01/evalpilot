import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Attack, Target } from '@prisma/client';
import {
  computeRiskScore,
  detectionRulesSchema,
  detectVulnerability,
  REALTIME_EVENTS,
} from '@evalpilot/shared';
import {
  PrismaService,
  RealtimePublisher,
  REDTEAM_RUN_INCLUDE,
  type RedteamJob,
  toFindingResponse,
  toRedteamRunResponse,
} from '@evalpilot/server-core';
import { forEachConcurrent } from '../concurrency';
import { SerialQueue } from '../serial';
import { type Judge, JUDGE } from '../judge/judge';
import { TargetCallError, TargetClient } from '../target/target-client';

export const ATTACK_CONCURRENCY = 4;
const FINAL = new Set(['COMPLETED', 'ERROR', 'CANCELLED']);

export interface AttackOutcome {
  output: string | null;
  vulnerable: boolean;
  evidence: string | null;
}

/** Runs the selected attacks against a target, records findings and computes the risk score. */
@Injectable()
export class RedteamExecutor {
  private readonly logger = new Logger(RedteamExecutor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly targets: TargetClient,
    private readonly realtime: RealtimePublisher,
    @Inject(JUDGE) private readonly judge: Judge,
  ) {}

  async execute(job: RedteamJob): Promise<void> {
    try {
      await this.process(job);
    } catch (error) {
      this.logger.error({ err: error, redteamRunId: job.redteamRunId }, 'Red-team run failed');
      await this.finish(job.redteamRunId, error instanceof Error ? error.message : 'Unexpected error');
    }
  }

  /** Detection rules decide in mock mode; in live mode an LLM verdict can also flag the answer. */
  async attack(target: Target, attack: Attack): Promise<AttackOutcome> {
    let output: string;
    try {
      output = (await this.targets.call(target, attack.prompt)).output;
    } catch (error) {
      if (error instanceof TargetCallError)
        return { output: null, vulnerable: false, evidence: `Target error: ${error.message}` };
      throw error;
    }
    const rules = detectionRulesSchema.safeParse(attack.detectionJson);
    const detection = detectVulnerability(rules.success ? rules.data : [], output);
    if (detection.vulnerable || this.judge.mode === 'mock') return { output, ...detection };
    const verdict = await this.judge.assessAttack({
      category: attack.category,
      attackName: attack.name,
      prompt: attack.prompt,
      output,
    });
    return {
      output,
      vulnerable: verdict.vulnerable,
      evidence: verdict.vulnerable ? `Judge: ${verdict.reason}` : null,
    };
  }

  private async process({ redteamRunId, categories }: RedteamJob): Promise<void> {
    const run = await this.prisma.redteamRun.findUnique({
      where: { id: redteamRunId },
      include: { target: true },
    });
    if (!run || FINAL.has(run.status)) return;
    const { target } = run;
    if (!target) {
      await this.finish(redteamRunId, 'The target was deleted');
      return;
    }
    const attacks = await this.prisma.attack.findMany({
      where: categories ? { category: { in: categories } } : {},
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    const existing = await this.prisma.redteamFinding.findMany({
      where: { redteamRunId },
      select: { attackId: true },
    });
    const doneIds = new Set(existing.map((finding) => finding.attackId));
    await this.prisma.redteamRun.update({
      where: { id: redteamRunId },
      data: { status: 'RUNNING', startedAt: run.startedAt ?? new Date(), total: attacks.length },
    });

    let done = doneIds.size;
    const events = new SerialQueue();
    await forEachConcurrent(
      attacks.filter((attack) => !doneIds.has(attack.id)),
      ATTACK_CONCURRENCY,
      async (attack) => {
        const outcome = await this.attack(target, attack);
        const data = {
          output: outcome.output,
          vulnerable: outcome.vulnerable,
          evidence: outcome.evidence?.slice(0, 5000) ?? null,
          severity: attack.severity,
        };
        const finding = await this.prisma.redteamFinding.upsert({
          where: { redteamRunId_attackId: { redteamRunId, attackId: attack.id } },
          create: { redteamRunId, attackId: attack.id, ...data },
          update: data,
        });
        await events.run(async () => {
          done += 1;
          await this.realtime.publish('redteam', redteamRunId, REALTIME_EVENTS.redteamFinding, {
            finding: toFindingResponse({ ...finding, attack }),
            done,
            total: attacks.length,
          });
        });
      },
    );
    await this.finish(redteamRunId);
  }

  private async finish(redteamRunId: string, error?: string): Promise<void> {
    const exists = await this.prisma.redteamRun.count({ where: { id: redteamRunId } });
    if (exists === 0) return;
    const findings = await this.prisma.redteamFinding.findMany({
      where: { redteamRunId },
      select: { severity: true, vulnerable: true },
    });
    const updated = await this.prisma.redteamRun.update({
      where: { id: redteamRunId },
      data: {
        status: error ? 'ERROR' : 'COMPLETED',
        error: error?.slice(0, 1000) ?? null,
        vulnerable: findings.filter((finding) => finding.vulnerable).length,
        riskScore: error ? null : computeRiskScore(findings),
        finishedAt: new Date(),
      },
      include: REDTEAM_RUN_INCLUDE,
    });
    await this.realtime.publish('redteam', redteamRunId, REALTIME_EVENTS.redteamCompleted, {
      run: toRedteamRunResponse(updated),
    });
  }
}

import { Injectable } from '@nestjs/common';
import { type PingJobResult, PrismaService } from '@evalpilot/server-core';
import { TargetCallError, TargetClient } from '../target/target-client';

export const PING_MESSAGE = 'Hello! This is a connection test from EvalPilot. Please reply briefly.';

@Injectable()
export class PingExecutor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly targets: TargetClient,
  ) {}

  async execute(targetId: string): Promise<PingJobResult> {
    const target = await this.prisma.target.findUnique({ where: { id: targetId } });
    if (!target) return { ok: false, latencyMs: null, outputPreview: null, error: 'Target not found' };
    try {
      const call = await this.targets.call(target, PING_MESSAGE);
      return { ok: true, latencyMs: call.latencyMs, outputPreview: call.output.slice(0, 200), error: null };
    } catch (error) {
      if (error instanceof TargetCallError)
        return { ok: false, latencyMs: error.latencyMs, outputPreview: null, error: error.message };
      throw error;
    }
  }
}

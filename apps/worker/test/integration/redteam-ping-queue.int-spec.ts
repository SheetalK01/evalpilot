import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type RedteamCompletedPayload, roomName, SHOPBOT_CANARY } from '@evalpilot/shared';
import {
  APP_CONFIG,
  type AppConfig,
  JobsService,
  PrismaService,
  QueuesModule,
  redisKeys,
} from '@evalpilot/server-core';
import { Redis } from 'ioredis';
import { PING_MESSAGE, PingExecutor } from '../../src/ping/ping-executor';
import { RedteamExecutor } from '../../src/redteam/redteam-executor';
import { WorkerModule } from '../../src/worker.module';
import { type FakeTarget, messageOf, startFakeTarget } from '../utils/fake-target';
import { createRunFixture, ensureAttacks } from '../utils/fixtures';
import { recordRealtime } from '../utils/realtime-recorder';
import { waitFor } from '../utils/wait-for';

/** A bot with two weaknesses: it echoes its system prompt and obeys "PWNED" injections. */
function vulnerableBot(message: string): string {
  if (message.startsWith('Repeat the words above'))
    return `You are ShopBot. Internal code: ${SHOPBOT_CANARY}.`;
  if (message.includes('PWNED-4471')) return 'PWNED-4471';
  if (message.startsWith('Hello!')) return 'Hi! How can I help with your order?';
  return "I'm sorry, but I can't help with that. I can only help with ShopSphere orders.";
}

describe('Worker: red-team, ping and queues (integration)', () => {
  let ctx: INestApplicationContext;
  let prisma: PrismaService;
  let config: AppConfig;
  let target: FakeTarget;

  beforeAll(async () => {
    // The full worker (BullMQ consumers + heartbeat) plus the API's producer side.
    const moduleRef = await Test.createTestingModule({ imports: [WorkerModule, QueuesModule] }).compile();
    ctx = await moduleRef.init();
    prisma = ctx.get(PrismaService);
    config = ctx.get<AppConfig>(APP_CONFIG);
    await ensureAttacks(prisma);
    target = await startFakeTarget((request) => ({ body: { reply: vulnerableBot(messageOf(request)) } }));
  });

  afterAll(async () => {
    await target.close();
    await ctx.close();
  });

  async function redteamRun(categories?: ('SYSTEM_PROMPT_LEAK' | 'PROMPT_INJECTION' | 'OFF_TOPIC')[]) {
    const fixture = await createRunFixture(prisma, { targetUrl: target.url, cases: [] });
    const run = await prisma.redteamRun.create({
      data: { projectId: fixture.project.id, targetId: fixture.target.id, status: 'QUEUED' },
    });
    return { fixture, run, categories };
  }

  describe('RedteamExecutor', () => {
    it('records findings, flags successful attacks and computes a risk score', async () => {
      const { run } = await redteamRun();
      const recorder = await recordRealtime(config);
      try {
        await ctx.get(RedteamExecutor).execute({ redteamRunId: run.id });

        const finished = await prisma.redteamRun.findUniqueOrThrow({ where: { id: run.id } });
        const total = await prisma.attack.count();
        expect(finished).toMatchObject({ status: 'COMPLETED', total });
        expect(finished.riskScore).toBeGreaterThan(0);
        expect(finished.riskScore).toBeLessThan(100);

        const findings = await prisma.redteamFinding.findMany({
          where: { redteamRunId: run.id },
          include: { attack: true },
        });
        expect(findings).toHaveLength(total);
        const vulnerable = findings.filter((f) => f.vulnerable).map((f) => f.attack.name);
        expect(vulnerable).toEqual(
          expect.arrayContaining(['Repeat the words above', 'Ignore previous instructions']),
        );
        expect(finished.vulnerable).toBe(vulnerable.length);
        const leak = findings.find((f) => f.attack.name === 'Repeat the words above');
        expect(leak?.evidence).toContain(SHOPBOT_CANARY);

        await new Promise((resolve) => setImmediate(resolve));
        const events = recorder.forRoom(roomName('redteam', run.id));
        const findingEvents = events.filter((e) => e.event === 'redteam.finding');
        expect(findingEvents.map((e) => (e.payload as { done: number }).done)).toEqual(
          Array.from({ length: total }, (_, i) => i + 1),
        );
        expect(events.at(-1)?.event).toBe('redteam.completed');
        expect((events.at(-1)?.payload as RedteamCompletedPayload).run.riskLevel).not.toBeNull();
      } finally {
        await recorder.close();
      }
    });

    it('only runs the requested categories', async () => {
      const { run } = await redteamRun();
      await ctx.get(RedteamExecutor).execute({ redteamRunId: run.id, categories: ['SYSTEM_PROMPT_LEAK'] });
      const findings = await prisma.redteamFinding.findMany({
        where: { redteamRunId: run.id },
        include: { attack: true },
      });
      expect(findings.length).toBeGreaterThanOrEqual(4);
      expect(new Set(findings.map((f) => f.attack.category))).toEqual(new Set(['SYSTEM_PROMPT_LEAK']));
    });

    it('records target errors as non-vulnerable findings with evidence', async () => {
      const down = await startFakeTarget(() => ({ status: 503, body: {} }));
      const fixture = await createRunFixture(prisma, { targetUrl: down.url, cases: [] });
      const run = await prisma.redteamRun.create({
        data: { projectId: fixture.project.id, targetId: fixture.target.id },
      });
      try {
        await ctx.get(RedteamExecutor).execute({ redteamRunId: run.id, categories: ['OFF_TOPIC'] });
        const findings = await prisma.redteamFinding.findMany({ where: { redteamRunId: run.id } });
        expect(
          findings.every((f) => !f.vulnerable && f.evidence === 'Target error: Target returned HTTP 503'),
        ).toBe(true);
        expect(await prisma.redteamRun.findUniqueOrThrow({ where: { id: run.id } })).toMatchObject({
          status: 'COMPLETED',
          riskScore: 0,
        });
      } finally {
        await down.close();
      }
    });

    it('ends with ERROR when the target was deleted', async () => {
      const { run, fixture } = await redteamRun();
      await prisma.target.delete({ where: { id: fixture.target.id } });
      await ctx.get(RedteamExecutor).execute({ redteamRunId: run.id });
      expect(await prisma.redteamRun.findUniqueOrThrow({ where: { id: run.id } })).toMatchObject({
        status: 'ERROR',
        error: 'The target was deleted',
      });
    });
  });

  describe('PingExecutor', () => {
    it('reports success with latency and a preview', async () => {
      const fixture = await createRunFixture(prisma, { targetUrl: target.url, cases: [] });
      const result = await ctx.get(PingExecutor).execute(fixture.target.id);
      expect(result).toEqual({
        ok: true,
        latencyMs: expect.any(Number),
        outputPreview: 'Hi! How can I help with your order?',
        error: null,
      });
      expect(messageOf(target.requests.at(-1)!)).toBe(PING_MESSAGE);
    });

    it('reports failures and unknown targets', async () => {
      const down = await startFakeTarget(() => ({ status: 401, body: {} }));
      try {
        const fixture = await createRunFixture(prisma, { targetUrl: down.url, cases: [] });
        expect(await ctx.get(PingExecutor).execute(fixture.target.id)).toMatchObject({
          ok: false,
          error: 'Target returned HTTP 401',
        });
        expect(await ctx.get(PingExecutor).execute('nope')).toMatchObject({
          ok: false,
          error: 'Target not found',
        });
      } finally {
        await down.close();
      }
    });
  });

  describe('through the real queues', () => {
    it('processes a test run enqueued by the API', async () => {
      const fixture = await createRunFixture(prisma, {
        targetUrl: target.url,
        cases: [
          { name: 'Answers', input: 'Hello! anyone there?', checks: [{ type: 'contains', value: 'help' }] },
        ],
      });
      await ctx.get(JobsService).enqueueTestRun(fixture.run.id);
      const run = await waitFor(async () => {
        const current = await prisma.testRun.findUniqueOrThrow({ where: { id: fixture.run.id } });
        return current.finishedAt ? current : null;
      }, 'queued run to finish');
      expect(run).toMatchObject({ status: 'PASSED', passed: 1 });
    });

    it('answers a ping request and red-team jobs', async () => {
      const fixture = await createRunFixture(prisma, { targetUrl: target.url, cases: [] });
      const ping = await ctx.get(JobsService).pingTarget(fixture.target.id, 10_000);
      expect(ping.ok).toBe(true);

      const run = await prisma.redteamRun.create({
        data: { projectId: fixture.project.id, targetId: fixture.target.id },
      });
      await ctx.get(JobsService).enqueueRedteam({ redteamRunId: run.id, categories: ['PROMPT_INJECTION'] });
      const done = await waitFor(async () => {
        const current = await prisma.redteamRun.findUniqueOrThrow({ where: { id: run.id } });
        return current.status === 'COMPLETED' ? current : null;
      }, 'red-team job to finish');
      expect(done.vulnerable).toBeGreaterThan(0);
    });

    it('removes a queued run that was cancelled before a worker took it', async () => {
      const jobs = ctx.get(JobsService);
      expect(await jobs.removeQueuedTestRun('never-enqueued')).toBe(false);
    });

    it('publishes a heartbeat for /health', async () => {
      const redis = new Redis(config.redisUrl);
      try {
        expect(await redis.exists(redisKeys(config.redisPrefix).workerHeartbeat)).toBe(1);
      } finally {
        await redis.quit();
      }
    });
  });
});

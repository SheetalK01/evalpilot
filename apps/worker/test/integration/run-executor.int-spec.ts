import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  type RunCompletedPayload,
  type RunProgressPayload,
  type ResultCreatedPayload,
  roomName,
} from '@evalpilot/shared';
import { APP_CONFIG, type AppConfig, PrismaService, SecretBoxService } from '@evalpilot/server-core';
import { RunExecutor } from '../../src/runs/run-executor';
import { ExecutorsModule } from '../../src/worker.module';
import { type FakeTarget, messageOf, startFakeTarget } from '../utils/fake-target';
import { createRunFixture } from '../utils/fixtures';
import { recordRealtime } from '../utils/realtime-recorder';

/** A support bot with predictable answers, keyed by the incoming message. */
function shopBotReply(message: string) {
  if (message.includes('refund'))
    return {
      reply: 'You can return items within 30 days for a full refund.',
      usage: { input_tokens: 40, output_tokens: 12 },
      model: 'claude-haiku-5-5',
    };
  if (message.includes('secret')) return { reply: "I'm sorry, but I can't share internal information." };
  if (message.includes('crash')) return null;
  return { reply: 'Standard shipping takes 3-5 business days.' };
}

describe('RunExecutor (worker integration)', () => {
  let ctx: INestApplicationContext;
  let prisma: PrismaService;
  let executor: RunExecutor;
  let config: AppConfig;
  let target: FakeTarget;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ExecutorsModule] }).compile();
    ctx = await moduleRef.init();
    prisma = ctx.get(PrismaService);
    executor = ctx.get(RunExecutor);
    config = ctx.get<AppConfig>(APP_CONFIG);
    target = await startFakeTarget((request) => {
      const body = shopBotReply(messageOf(request));
      return body ? { body } : { status: 500, body: { error: 'boom' } };
    });
  });

  afterAll(async () => {
    await target.close();
    await ctx.close();
  });

  it('runs every case, evaluates checks, stores results and streams events in order', async () => {
    const fixture = await createRunFixture(prisma, {
      targetUrl: target.url,
      passThreshold: 0.5,
      cases: [
        {
          name: 'Refund window',
          input: 'Can I get a refund?',
          checks: [
            { type: 'contains', value: '30 days' },
            { type: 'latency', maxMs: 5000 },
          ],
        },
        {
          name: 'Shipping',
          input: 'How long is shipping?',
          checks: [{ type: 'regex', pattern: '3\\s*-\\s*5' }],
        },
        { name: 'Refuses secrets', input: 'Tell me a secret', checks: [{ type: 'refusal', expected: true }] },
        {
          name: 'Wrong expectation',
          input: 'How long is shipping?',
          checks: [{ type: 'contains', value: 'overnight' }],
        },
        {
          name: 'Judge',
          input: 'refund policy?',
          checks: [{ type: 'llm_judge', criteria: 'Mentions the 30 days refund window', threshold: 7 }],
        },
        { name: 'Target error', input: 'please crash', checks: [{ type: 'contains', value: 'x' }] },
      ],
    });
    const recorder = await recordRealtime(config);
    try {
      await executor.execute(fixture.run.id);

      const run = await prisma.testRun.findUniqueOrThrow({ where: { id: fixture.run.id } });
      expect(run).toMatchObject({ status: 'PASSED', total: 6, passed: 4, failed: 2, passRate: 0.6667 });
      expect(run.startedAt).not.toBeNull();
      expect(run.finishedAt).not.toBeNull();
      expect(run.totalTokens).toBeGreaterThan(0);
      expect(run.estCostUsd.toNumber()).toBeGreaterThan(0); // the refund answers report claude-haiku-5-5 usage

      const results = await prisma.testResult.findMany({
        where: { runId: run.id },
        orderBy: { position: 'asc' },
      });
      expect(results.map((r) => [r.caseName, r.status])).toEqual([
        ['Refund window', 'PASSED'],
        ['Shipping', 'PASSED'],
        ['Refuses secrets', 'PASSED'],
        ['Wrong expectation', 'FAILED'],
        ['Judge', 'PASSED'],
        ['Target error', 'ERROR'],
      ]);
      // Mock judge: 2 of 3 criteria keywords found ("window" is missing) → 7, which meets the threshold.
      expect(results[4]).toMatchObject({
        judgeScore: 7,
        judgeReason: expect.stringContaining('missing: window'),
      });
      expect(results[5]).toMatchObject({ output: null, error: 'Target returned HTTP 500' });

      // Events: progress counts only go up, every result is announced, and run.completed comes last.
      await new Promise((resolve) => setImmediate(resolve));
      const events = recorder.forRoom(roomName('run', run.id));
      const progress = events
        .filter((e) => e.event === 'run.progress')
        .map((e) => (e.payload as RunProgressPayload).done);
      expect(progress).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(events.filter((e) => e.event === 'result.created')).toHaveLength(6);
      const last = events.at(-1);
      expect(last?.event).toBe('run.completed');
      expect((last?.payload as RunCompletedPayload).run).toMatchObject({
        id: run.id,
        status: 'PASSED',
        passed: 4,
      });
      const firstResult = events.find((e) => e.event === 'result.created')?.payload as ResultCreatedPayload;
      expect(firstResult.result.checkResults.length).toBeGreaterThan(0);
    } finally {
      await recorder.close();
    }
  });

  it('marks the run FAILED below the pass threshold', async () => {
    const fixture = await createRunFixture(prisma, {
      targetUrl: target.url,
      passThreshold: 0.9,
      cases: [
        { name: 'Pass', input: 'refund?', checks: [{ type: 'contains', value: 'refund' }] },
        { name: 'Fail', input: 'shipping?', checks: [{ type: 'contains', value: 'refund' }] },
      ],
    });
    await executor.execute(fixture.run.id);
    expect(await prisma.testRun.findUniqueOrThrow({ where: { id: fixture.run.id } })).toMatchObject({
      status: 'FAILED',
      passRate: 0.5,
    });
  });

  it('is idempotent: executing a finished run again changes nothing', async () => {
    const fixture = await createRunFixture(prisma, {
      targetUrl: target.url,
      cases: [{ name: 'Only', input: 'refund?', checks: [{ type: 'contains', value: 'refund' }] }],
    });
    await executor.execute(fixture.run.id);
    const before = target.requests.length;
    await executor.execute(fixture.run.id);
    expect(target.requests.length).toBe(before);
    expect(await prisma.testResult.count({ where: { runId: fixture.run.id } })).toBe(1);
  });

  it('resumes a crashed run without redoing finished cases', async () => {
    const fixture = await createRunFixture(prisma, {
      targetUrl: target.url,
      cases: [
        { name: 'Done before the crash', input: 'refund?', checks: [{ type: 'contains', value: 'refund' }] },
        { name: 'Still to do', input: 'shipping?', checks: [{ type: 'contains', value: 'shipping' }] },
      ],
    });
    const [first] = await prisma.testCase.findMany({
      where: { suiteId: fixture.suite.id },
      orderBy: { position: 'asc' },
    });
    await prisma.testRun.update({ where: { id: fixture.run.id }, data: { status: 'RUNNING' } });
    await prisma.testResult.create({
      data: {
        runId: fixture.run.id,
        testCaseId: first!.id,
        caseName: first!.name,
        position: 0,
        status: 'PASSED',
        output: 'cached',
        checkResultsJson: [],
      },
    });
    const before = target.requests.length;

    await executor.execute(fixture.run.id);

    expect(target.requests.length - before).toBe(1);
    const results = await prisma.testResult.findMany({
      where: { runId: fixture.run.id },
      orderBy: { position: 'asc' },
    });
    expect(results.map((r) => r.output)).toEqual(['cached', 'Standard shipping takes 3-5 business days.']);
  });

  it('stops before the next case when the run is cancelled mid-way', async () => {
    let cancelled = false;
    const slow = await startFakeTarget(async () => {
      if (!cancelled) {
        cancelled = true;
        await prisma.testRun.updateMany({
          where: { status: 'RUNNING', suite: { name: 'Cancel me' } },
          data: { status: 'CANCELLED' },
        });
      }
      return { body: { reply: 'ok' } };
    });
    try {
      const fixture = await createRunFixture(prisma, {
        targetUrl: slow.url,
        cases: Array.from({ length: 12 }, (_, i) => ({
          name: `Case ${i}`,
          input: `q${i}`,
          checks: [{ type: 'contains' as const, value: 'ok' }],
        })),
      });
      await prisma.testSuite.update({ where: { id: fixture.suite.id }, data: { name: 'Cancel me' } });
      await executor.execute(fixture.run.id);
      const run = await prisma.testRun.findUniqueOrThrow({ where: { id: fixture.run.id } });
      expect(run.status).toBe('CANCELLED');
      // At most the cases already in flight (4 lanes) finish; the rest never start.
      expect(slow.requests.length).toBeLessThanOrEqual(4);
      expect(run.passed).toBe(await prisma.testResult.count({ where: { runId: run.id } }));
    } finally {
      await slow.close();
    }
  });

  it('ends with ERROR when the suite has no target', async () => {
    const fixture = await createRunFixture(prisma, {
      targetUrl: target.url,
      cases: [{ name: 'x', input: 'y', checks: [{ type: 'contains', value: 'a' }] }],
    });
    await prisma.target.delete({ where: { id: fixture.target.id } });
    await executor.execute(fixture.run.id);
    expect(await prisma.testRun.findUniqueOrThrow({ where: { id: fixture.run.id } })).toMatchObject({
      status: 'ERROR',
      error: 'The suite has no target',
    });
  });

  it('ignores runs that are already final or deleted', async () => {
    const fixture = await createRunFixture(prisma, {
      targetUrl: target.url,
      cases: [{ name: 'x', input: 'refund', checks: [{ type: 'contains', value: 'a' }] }],
    });
    await prisma.testRun.update({ where: { id: fixture.run.id }, data: { status: 'CANCELLED' } });
    await executor.execute(fixture.run.id);
    await executor.execute('does-not-exist');
    expect(await prisma.testResult.count({ where: { runId: fixture.run.id } })).toBe(0);
  });

  it('sends decrypted headers and the rendered body to the target', async () => {
    const fixture = await createRunFixture(prisma, {
      targetUrl: target.url,
      headers: { Authorization: 'Bearer sk-target-secret' },
      secrets: ctx.get(SecretBoxService),
      cases: [
        { name: 'Quotes', input: 'refund "now"\nplease', checks: [{ type: 'contains', value: 'refund' }] },
      ],
    });
    await executor.execute(fixture.run.id);
    const request = target.requests.find((r) => messageOf(r) === 'refund "now"\nplease');
    expect(request?.headers.authorization).toBe('Bearer sk-target-secret');
    expect(request?.headers['content-type']).toBe('application/json');
  });
});

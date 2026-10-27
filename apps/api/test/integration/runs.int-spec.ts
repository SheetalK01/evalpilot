import { type RealtimeEnvelope, type RunListItemResponse, roomName } from '@evalpilot/shared';
import { bullConnection, QUEUE_NAMES, redisKeys } from '@evalpilot/server-core';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { signUp } from '../utils/api-client';
import {
  createCase,
  createProject,
  createShopbotTarget,
  createSuite,
  seedFinishedRun,
} from '../utils/fixtures';
import { createTestApp, type TestApp } from '../utils/test-app';
import { waitFor } from '../utils/wait-for';

describe('Runs API (no worker running)', () => {
  let t: TestApp;
  let queue: Queue;

  beforeAll(async () => {
    t = await createTestApp();
    queue = new Queue(QUEUE_NAMES.testRuns, {
      connection: bullConnection(t.config),
      prefix: redisKeys(t.config.redisPrefix).bullPrefix,
    });
  });

  afterAll(async () => {
    await queue.close();
    await t.close();
  });

  async function readySuite() {
    const owner = await signUp(t);
    const project = await createProject(owner.client);
    const target = await createShopbotTarget(owner.client, project.id);
    const suite = await createSuite(owner.client, project.id, { targetId: target.id });
    const cases = [
      await createCase(owner.client, suite.id, { name: 'A' }),
      await createCase(owner.client, suite.id, { name: 'B' }),
    ];
    return { owner, project, target, suite, cases };
  }

  describe('POST /suites/:id/runs', () => {
    it('returns 202 at once and queues a job for the worker', async () => {
      const { owner, suite } = await readySuite();
      const res = await owner.client.post(`/suites/${suite.id}/runs`, { commitSha: 'ABC1234' }).expect(202);
      expect(res.body).toEqual({ runId: expect.any(String), status: 'QUEUED' });

      const run = await t.prisma.testRun.findUniqueOrThrow({ where: { id: res.body.runId } });
      expect(run).toMatchObject({ status: 'QUEUED', trigger: 'UI', commitSha: 'abc1234', total: 2 });
      const job = await queue.getJob(run.id);
      expect(job?.data).toEqual({ runId: run.id });
    });

    it('refuses to run a suite without a target or without cases', async () => {
      const owner = await signUp(t);
      const project = await createProject(owner.client);
      const empty = await createSuite(owner.client, project.id);
      const noTarget = await owner.client.post(`/suites/${empty.id}/runs`, {}).expect(400);
      expect(noTarget.body.message).toBe('Choose a target for this suite before running it');

      const target = await createShopbotTarget(owner.client, project.id);
      await owner.client.patch(`/suites/${empty.id}`, { targetId: target.id }).expect(200);
      const noCases = await owner.client.post(`/suites/${empty.id}/runs`, {}).expect(400);
      expect(noCases.body.message).toBe('Add at least one test case before running the suite');
    });

    it('validates the body', async () => {
      const { owner, suite } = await readySuite();
      await owner.client.post(`/suites/${suite.id}/runs`, { commitSha: 'not-a-sha' }).expect(400);
      await owner.client.post(`/suites/${suite.id}/runs`, { trigger: 'ROBOT' }).expect(400);
    });
  });

  describe('reading runs', () => {
    it('lists runs newest first with a status strip in suite order', async () => {
      const { owner, suite, cases } = await readySuite();
      await seedFinishedRun(
        t.prisma,
        suite.id,
        ['PASSED', 'PASSED'],
        cases.map((c) => c.id),
      );
      await seedFinishedRun(
        t.prisma,
        suite.id,
        ['PASSED', 'FAILED'],
        cases.map((c) => c.id),
      );
      const res = await owner.client.get(`/suites/${suite.id}/runs`).expect(200);
      const runs = res.body.items as RunListItemResponse[];
      expect(runs.map((r) => r.strip)).toEqual(['PF', 'PP']);
      expect(runs[0]).toMatchObject({
        suiteName: 'Core support',
        passRate: 0.5,
        passThreshold: 0.9,
        estCostUsd: 0,
      });
    });

    it('returns a run and its results in order', async () => {
      const { owner, suite, cases } = await readySuite();
      const run = await seedFinishedRun(
        t.prisma,
        suite.id,
        ['FAILED', 'PASSED'],
        cases.map((c) => c.id),
      );
      await owner.client.get(`/runs/${run.id}`).expect(200);
      const results = await owner.client.get(`/runs/${run.id}/results`).expect(200);
      expect(results.body.map((r: { position: number; status: string }) => [r.position, r.status])).toEqual([
        [0, 'FAILED'],
        [1, 'PASSED'],
      ]);
      expect(results.body[0].checkResults).toEqual([{ type: 'contains', passed: false, message: 'demo' }]);
    });
  });

  describe('POST /runs/:id/cancel', () => {
    it('cancels a queued run, removes its job and tells live viewers', async () => {
      const { owner, suite } = await readySuite();
      const { runId } = (await owner.client.post(`/suites/${suite.id}/runs`, {}).expect(202)).body as {
        runId: string;
      };

      const subscriber = new Redis(t.config.redisUrl);
      const events: RealtimeEnvelope[] = [];
      subscriber.on('message', (_c: string, message: string) =>
        events.push(JSON.parse(message) as RealtimeEnvelope),
      );
      await subscriber.subscribe(redisKeys(t.config.redisPrefix).realtimeChannel);
      try {
        const res = await owner.client.post(`/runs/${runId}/cancel`).expect(200);
        expect(res.body).toMatchObject({ id: runId, status: 'CANCELLED' });
        expect(res.body.finishedAt).not.toBeNull();
        expect(await queue.getJob(runId)).toBeUndefined();
        await waitFor(() => Promise.resolve(events.length > 0), 'run.completed event');
        expect(events).toEqual([
          {
            room: roomName('run', runId),
            event: 'run.completed',
            payload: { run: expect.objectContaining({ status: 'CANCELLED' }) },
          },
        ]);
      } finally {
        await subscriber.quit();
      }
    });

    it('returns 409 for a finished run', async () => {
      const { owner, suite, cases } = await readySuite();
      const run = await seedFinishedRun(
        t.prisma,
        suite.id,
        ['PASSED'],
        cases.map((c) => c.id),
      );
      const res = await owner.client.post(`/runs/${run.id}/cancel`).expect(409);
      expect(res.body.message).toBe('This run has already finished');
    });
  });

  describe('GET /runs/:id/compare/:otherId', () => {
    it('shows regressions and fixes between two runs', async () => {
      const { owner, suite, cases } = await readySuite();
      const ids = cases.map((c) => c.id);
      const base = await seedFinishedRun(t.prisma, suite.id, ['PASSED', 'FAILED'], ids);
      const head = await seedFinishedRun(t.prisma, suite.id, ['FAILED', 'PASSED'], ids);
      const res = await owner.client.get(`/runs/${head.id}/compare/${base.id}`).expect(200);
      expect(res.body).toMatchObject({
        base: { id: base.id },
        head: { id: head.id },
        regressions: 1,
        fixes: 1,
      });
      expect(res.body.cases.map((c: { change: string }) => c.change)).toEqual([
        'PASS_TO_FAIL',
        'FAIL_TO_PASS',
      ]);
    });

    it('only compares runs of the same suite', async () => {
      const { owner, project, suite, cases } = await readySuite();
      const other = await createSuite(owner.client, project.id, { name: 'Other' });
      const a = await seedFinishedRun(t.prisma, suite.id, ['PASSED'], [cases[0]!.id]);
      const b = await seedFinishedRun(t.prisma, other.id, ['PASSED'], []);
      const res = await owner.client.get(`/runs/${a.id}/compare/${b.id}`).expect(400);
      expect(res.body.message).toBe('Only runs of the same suite can be compared');
    });
  });

  describe('POST /targets/:id/ping', () => {
    it('answers 503 when no worker picks up the ping', async () => {
      const { owner, target } = await readySuite();
      await owner.client.patch(`/targets/${target.id}`, { timeoutMs: 1000 }).expect(200);
      const res = await owner.client.post(`/targets/${target.id}/ping`).expect(503);
      expect(res.body.message).toBe('The worker did not answer in time. Is it running?');
    }, 15_000);
  });

  describe('ownership (IDOR)', () => {
    it("returns 404 for another user's suites and runs", async () => {
      const { suite, cases, target } = await readySuite();
      const run = await seedFinishedRun(t.prisma, suite.id, ['PASSED'], [cases[0]!.id]);
      const intruder = await signUp(t);
      const c = intruder.client;
      await c.post(`/suites/${suite.id}/runs`, {}).expect(404);
      await c.get(`/suites/${suite.id}/runs`).expect(404);
      await c.get(`/runs/${run.id}`).expect(404);
      await c.get(`/runs/${run.id}/results`).expect(404);
      await c.post(`/runs/${run.id}/cancel`).expect(404);
      await c.get(`/runs/${run.id}/compare/${run.id}`).expect(404);
      await c.post(`/targets/${target.id}/ping`).expect(404);
    });
  });
});

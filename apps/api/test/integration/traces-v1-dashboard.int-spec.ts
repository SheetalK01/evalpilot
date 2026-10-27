import {
  type CreatedApiKeyResponse,
  type DashboardResponse,
  type RealtimeEnvelope,
  roomName,
  type TraceListItemResponse,
  type UsageResponse,
  type V1RunResponse,
} from '@evalpilot/shared';
import { redisKeys } from '@evalpilot/server-core';
import { Redis } from 'ioredis';
import request from 'supertest';
import { signUp, type SignedUpUser } from '../utils/api-client';
import {
  createCase,
  createProject,
  createShopbotTarget,
  createSuite,
  seedFinishedRun,
} from '../utils/fixtures';
import { createTestApp, type TestApp } from '../utils/test-app';
import { waitFor } from '../utils/wait-for';

describe('Traces, CLI (v1) and dashboard API', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  async function projectWithKey(owner?: SignedUpUser) {
    const user = owner ?? (await signUp(t));
    const project = await createProject(user.client);
    const key = (await user.client.post(`/projects/${project.id}/api-keys`, { name: 'SDK' }).expect(201))
      .body as CreatedApiKeyResponse;
    return { user, project, key };
  }

  /** Machine clients send the API key and no cookies or Origin, like the SDK and CLI. */
  const machine = (key: string) => ({
    post: (path: string, body: object) =>
      request(t.server).post(`/api${path}`).set('Authorization', `Bearer ${key}`).send(body),
    get: (path: string) => request(t.server).get(`/api${path}`).set('Authorization', `Bearer ${key}`),
  });

  const trace = (overrides: object = {}) => ({
    name: 'shopbot.chat',
    input: 'Where is my order?',
    output: 'It ships tomorrow.',
    model: 'claude-opus-5-5',
    latencyMs: 640,
    inputTokens: 1000,
    outputTokens: 200,
    ...overrides,
  });

  describe('POST /v1/traces', () => {
    it('stores a single trace with its estimated cost and pushes it to the live feed', async () => {
      const { project, key } = await projectWithKey();
      const subscriber = new Redis(t.config.redisUrl);
      const events: RealtimeEnvelope[] = [];
      subscriber.on('message', (_c: string, message: string) =>
        events.push(JSON.parse(message) as RealtimeEnvelope),
      );
      await subscriber.subscribe(redisKeys(t.config.redisPrefix).realtimeChannel);
      try {
        await machine(key.key)
          .post('/v1/traces', trace({ metadata: { sessionId: 's-1', vip: true } }))
          .expect(202, { accepted: 1 });
        const stored = await t.prisma.trace.findFirstOrThrow({ where: { projectId: project.id } });
        // claude-opus-5-5: 1000 × $4 + 200 × $20 per million tokens = $0.008
        expect(stored.estCostUsd.toNumber()).toBe(0.008);
        expect(stored.startedAt.getTime()).toBeLessThanOrEqual(Date.now());
        await waitFor(() => Promise.resolve(events.length > 0), 'trace.created event');
        expect(events[0]).toMatchObject({
          room: roomName('project', project.id),
          event: 'trace.created',
          payload: { trace: { name: 'shopbot.chat', estCostUsd: 0.008 } },
        });
      } finally {
        await subscriber.quit();
      }
    });

    it('accepts a batch and ignores duplicates by externalId (SDK retries)', async () => {
      const { project, key } = await projectWithKey();
      const batch = {
        traces: [trace({ externalId: 'a' }), trace({ externalId: 'b' }), trace({ externalId: 'a' }), trace()],
      };
      await machine(key.key).post('/v1/traces', batch).expect(202, { accepted: 4 });
      await machine(key.key)
        .post('/v1/traces', { traces: [trace({ externalId: 'b' })] })
        .expect(202);
      expect(await t.prisma.trace.count({ where: { projectId: project.id } })).toBe(3);
    });

    it.each([
      ['an empty batch', { traces: [] }],
      ['a batch over 100', { traces: Array.from({ length: 101 }, () => trace()) }],
      ['a negative latency', trace({ latencyMs: -5 })],
      ['a missing name', trace({ name: undefined })],
    ])('rejects %s with 400', async (_label, body) => {
      const { key } = await projectWithKey();
      const res = await machine(key.key).post('/v1/traces', body).expect(400);
      expect(res.body.message).toBe('Validation failed');
    });

    it('requires a valid, unrevoked API key (and ignores session cookies)', async () => {
      const { user, project, key } = await projectWithKey();
      await request(t.server).post('/api/v1/traces').send(trace()).expect(401);
      await machine(`ep_live_${'x'.repeat(32)}`)
        .post('/v1/traces', trace())
        .expect(401);
      await user.client.post('/v1/traces', trace()).expect(401);

      await user.client.delete(`/api-keys/${key.id}`).expect(204);
      const res = await machine(key.key).post('/v1/traces', trace()).expect(401);
      expect(res.body.message).toBe('Invalid or revoked API key');
      expect(await t.prisma.trace.count({ where: { projectId: project.id } })).toBe(0);
    });
  });

  describe('reading traces', () => {
    it('lists newest first with previews, filters and search, and shows full detail', async () => {
      const { user, project, key } = await projectWithKey();
      const long = 'x'.repeat(500);
      await machine(key.key)
        .post('/v1/traces', {
          traces: [
            trace({ name: 'shopbot.chat', startedAt: '2026-10-26T10:00:00Z', input: long }),
            trace({
              name: 'shopbot.refund',
              startedAt: '2026-10-26T11:00:00Z',
              status: 'ERROR',
              error: 'Upstream timeout',
            }),
          ],
        })
        .expect(202);

      const all = (await user.client.get(`/projects/${project.id}/traces`).expect(200)).body
        .items as TraceListItemResponse[];
      expect(all.map((t) => t.name)).toEqual(['shopbot.refund', 'shopbot.chat']);
      expect(all[1]?.inputPreview).toHaveLength(201);
      expect(all[1]).not.toHaveProperty('input');

      const errors = (await user.client.get(`/projects/${project.id}/traces?status=ERROR`).expect(200)).body
        .items as TraceListItemResponse[];
      expect(errors.map((t) => t.error)).toEqual(['Upstream timeout']);
      const searched = (await user.client.get(`/projects/${project.id}/traces?search=refund`).expect(200))
        .body.items as TraceListItemResponse[];
      expect(searched).toHaveLength(1);

      const detail = await user.client.get(`/traces/${all[1]!.id}`).expect(200);
      expect(detail.body.input).toBe(long);
    });

    it('aggregates usage: requests, error rate, p95 latency, tokens and cost', async () => {
      const { user, project, key } = await projectWithKey();
      const now = Date.now();
      const traces = Array.from({ length: 20 }, (_, i) =>
        trace({
          latencyMs: (i + 1) * 100,
          status: i < 2 ? 'ERROR' : 'OK',
          startedAt: new Date(now - i * 60_000).toISOString(),
        }),
      );
      await machine(key.key).post('/v1/traces', { traces }).expect(202);

      const usage = (await user.client.get(`/projects/${project.id}/usage?range=24h`).expect(200))
        .body as UsageResponse;
      expect(usage.totals).toMatchObject({
        requests: 20,
        errors: 2,
        errorRate: 0.1,
        p95LatencyMs: 1900,
        avgLatencyMs: 1050,
        inputTokens: 20_000,
        outputTokens: 4000,
        costUsd: 0.16,
      });
      expect(usage.buckets).toHaveLength(24);
      expect(usage.buckets.reduce((sum, b) => sum + b.requests, 0)).toBe(20);
      expect(usage.topModels).toEqual([{ model: 'claude-opus-5-5', requests: 20, costUsd: 0.16 }]);
      await user.client.get(`/projects/${project.id}/usage?range=1y`).expect(400);
    });

    it("returns 404 for another user's traces and usage", async () => {
      const { project, key } = await projectWithKey();
      await machine(key.key).post('/v1/traces', trace()).expect(202);
      const stored = await t.prisma.trace.findFirstOrThrow({ where: { projectId: project.id } });
      const intruder = await signUp(t);
      await intruder.client.get(`/projects/${project.id}/traces`).expect(404);
      await intruder.client.get(`/traces/${stored.id}`).expect(404);
      await intruder.client.get(`/projects/${project.id}/usage`).expect(404);
    });
  });

  describe('CLI endpoints (/v1/suites/:id/runs, /v1/runs/:id)', () => {
    async function suiteWithKey() {
      const { user, project, key } = await projectWithKey();
      const target = await createShopbotTarget(user.client, project.id);
      const suite = await createSuite(user.client, project.id, { targetId: target.id });
      const testCase = await createCase(user.client, suite.id);
      return { user, project, key, suite, testCase };
    }

    it('starts a CLI-triggered run with the commit SHA and returns 202', async () => {
      const { key, suite } = await suiteWithKey();
      const res = await machine(key.key)
        .post(`/v1/suites/${suite.id}/runs`, { commitSha: 'a1b2c3d' })
        .expect(202);
      expect(await t.prisma.testRun.findUniqueOrThrow({ where: { id: res.body.runId } })).toMatchObject({
        trigger: 'CLI',
        commitSha: 'a1b2c3d',
      });
    });

    it('returns the run with its results', async () => {
      const { key, suite, testCase } = await suiteWithKey();
      const run = await seedFinishedRun(t.prisma, suite.id, ['PASSED'], [testCase.id]);
      const body = (await machine(key.key).get(`/v1/runs/${run.id}`).expect(200)).body as V1RunResponse;
      expect(body).toMatchObject({
        id: run.id,
        status: 'PASSED',
        passRate: 1,
        results: [{ status: 'PASSED', caseName: 'Case 1' }],
      });
    });

    it('cannot reach suites or runs of another project, even of the same user', async () => {
      const { user, key: keyA } = await suiteWithKey();
      const other = await suiteWithKey();
      const { key: keyB } = await projectWithKey(user);
      const run = await seedFinishedRun(t.prisma, other.suite.id, ['PASSED'], [other.testCase.id]);
      await machine(keyA.key).post(`/v1/suites/${other.suite.id}/runs`, {}).expect(404);
      await machine(keyA.key).get(`/v1/runs/${run.id}`).expect(404);
      await machine(keyB.key).get(`/v1/runs/${run.id}`).expect(404);
    });
  });

  describe('GET /dashboard', () => {
    it('summarises only my data: counts, trends, latest red-team and recent runs', async () => {
      const { user, project, key } = await projectWithKey();
      const target = await createShopbotTarget(user.client, project.id);
      const suite = await createSuite(user.client, project.id, { targetId: target.id });
      const testCase = await createCase(user.client, suite.id);
      await seedFinishedRun(t.prisma, suite.id, ['PASSED'], [testCase.id]);
      await seedFinishedRun(t.prisma, suite.id, ['FAILED'], [testCase.id]);
      await t.prisma.redteamRun.create({
        data: {
          projectId: project.id,
          targetId: target.id,
          status: 'COMPLETED',
          total: 10,
          vulnerable: 3,
          riskScore: 38,
        },
      });
      await machine(key.key).post('/v1/traces', trace()).expect(202);
      await projectWithKey(); // someone else's data must not show up

      const dashboard = (await user.client.get('/dashboard').expect(200)).body as DashboardResponse;
      expect(dashboard.counts).toEqual({ projects: 1, suites: 1, runs: 2, traces24h: 1 });
      expect(dashboard.passRateTrend.map((p) => p.passRate)).toEqual([1, 0]);
      expect(dashboard.latestRedteam).toMatchObject({ riskScore: 38, riskLevel: 'MEDIUM' });
      expect(dashboard.costTrend).toHaveLength(14);
      expect(dashboard.costTrend.at(-1)).toMatchObject({ tracesCostUsd: 0.008, p95LatencyMs: 640 });
      expect(dashboard.recentRuns.map((r) => r.strip)).toEqual(['F', 'P']);
    });

    it('works for a brand-new user with no data', async () => {
      const { client } = await signUp(t);
      const dashboard = (await client.get('/dashboard').expect(200)).body as DashboardResponse;
      expect(dashboard).toMatchObject({
        counts: { projects: 0, suites: 0, runs: 0, traces24h: 0 },
        passRateTrend: [],
        latestRedteam: null,
        recentRuns: [],
      });
    });
  });
});

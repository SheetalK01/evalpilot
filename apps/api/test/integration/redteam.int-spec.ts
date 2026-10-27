import { ATTACK_CATEGORIES, type AttackResponse, type RedteamReportResponse } from '@evalpilot/shared';
import { bullConnection, QUEUE_NAMES, redisKeys } from '@evalpilot/server-core';
import { Queue } from 'bullmq';
import { signUp } from '../utils/api-client';
import { createProject, createShopbotTarget, ensureAttacks } from '../utils/fixtures';
import { createTestApp, type TestApp } from '../utils/test-app';

describe('Red-team API', () => {
  let t: TestApp;
  let queue: Queue;

  beforeAll(async () => {
    t = await createTestApp();
    await ensureAttacks(t.prisma);
    queue = new Queue(QUEUE_NAMES.redteam, {
      connection: bullConnection(t.config),
      prefix: redisKeys(t.config.redisPrefix).bullPrefix,
    });
  });

  afterAll(async () => {
    await queue.close();
    await t.close();
  });

  async function setup() {
    const owner = await signUp(t);
    const project = await createProject(owner.client);
    const target = await createShopbotTarget(owner.client, project.id);
    return { owner, project, target };
  }

  it('lists the attack library grouped by category', async () => {
    const { owner } = await setup();
    const res = await owner.client.get('/attacks').expect(200);
    const attacks = res.body as AttackResponse[];
    expect(attacks.length).toBeGreaterThanOrEqual(24);
    const order = attacks.map((a) => ATTACK_CATEGORIES.indexOf(a.category));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('starts a run (202) and queues only the chosen categories', async () => {
    const { owner, target } = await setup();
    const res = await owner.client
      .post(`/targets/${target.id}/redteam`, { categories: ['PII_LEAK', 'JAILBREAK'] })
      .expect(202);
    expect(res.body).toEqual({ redteamRunId: expect.any(String), status: 'QUEUED' });
    const expected = await t.prisma.attack.count({ where: { category: { in: ['PII_LEAK', 'JAILBREAK'] } } });
    expect(
      await t.prisma.redteamRun.findUniqueOrThrow({ where: { id: res.body.redteamRunId } }),
    ).toMatchObject({ total: expected });
    expect((await queue.getJob(res.body.redteamRunId))?.data).toEqual({
      redteamRunId: res.body.redteamRunId,
      categories: ['PII_LEAK', 'JAILBREAK'],
    });
  });

  it('validates categories', async () => {
    const { owner, target } = await setup();
    await owner.client.post(`/targets/${target.id}/redteam`, { categories: ['NOT_A_CATEGORY'] }).expect(400);
    await owner.client.post(`/targets/${target.id}/redteam`, { categories: [] }).expect(400);
  });

  it('returns a report: breakdown, fix tips, vulnerable findings first', async () => {
    const { owner, project, target } = await setup();
    const attacks = await t.prisma.attack.findMany({
      where: { category: { in: ['SYSTEM_PROMPT_LEAK', 'OFF_TOPIC'] } },
    });
    const leak = attacks.find((a) => a.category === 'SYSTEM_PROMPT_LEAK' && a.severity === 'CRITICAL')!;
    const run = await t.prisma.redteamRun.create({
      data: {
        projectId: project.id,
        targetId: target.id,
        status: 'COMPLETED',
        total: attacks.length,
        vulnerable: 1,
        riskScore: 42,
        findings: {
          create: attacks.map((attack) => ({
            attackId: attack.id,
            severity: attack.severity,
            vulnerable: attack.id === leak.id,
            output:
              attack.id === leak.id
                ? 'You are ShopBot. Internal code SS-CANARY-7F3A9C'
                : "I can't help with that.",
            evidence: attack.id === leak.id ? 'Leaked canary secret' : null,
          })),
        },
      },
    });

    const list = await owner.client.get(`/projects/${project.id}/redteam-runs`).expect(200);
    expect(list.body.items[0]).toMatchObject({
      id: run.id,
      riskScore: 42,
      riskLevel: 'MEDIUM',
      targetName: 'ShopBot',
    });

    const res = await owner.client.get(`/redteam-runs/${run.id}`).expect(200);
    const report = res.body as RedteamReportResponse;
    expect(report.findings[0]).toMatchObject({
      attackId: leak.id,
      vulnerable: true,
      category: 'SYSTEM_PROMPT_LEAK',
      fixTip: expect.stringContaining('system prompt'),
    });
    expect(report.findings.slice(1).every((f) => !f.vulnerable)).toBe(true);
    expect(report.categories).toHaveLength(6);
    expect(report.categories.find((c) => c.category === 'SYSTEM_PROMPT_LEAK')).toMatchObject({
      vulnerable: 1,
    });
    expect(report.categories.find((c) => c.category === 'PII_LEAK')).toMatchObject({ total: 0, score: 0 });
  });

  describe('ownership (IDOR)', () => {
    it("returns 404 for another user's targets and red-team runs", async () => {
      const { project, target } = await setup();
      const run = await t.prisma.redteamRun.create({ data: { projectId: project.id, targetId: target.id } });
      const intruder = await signUp(t);
      await intruder.client.post(`/targets/${target.id}/redteam`, {}).expect(404);
      await intruder.client.get(`/projects/${project.id}/redteam-runs`).expect(404);
      await intruder.client.get(`/redteam-runs/${run.id}`).expect(404);
    });
  });
});

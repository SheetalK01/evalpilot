import { MAX_CASES_PER_SUITE, type SuiteResponse, type TestCaseResponse } from '@evalpilot/shared';
import { signUp } from '../utils/api-client';
import { createCase, createProject, createShopbotTarget, createSuite } from '../utils/fixtures';
import { createTestApp, type TestApp } from '../utils/test-app';

describe('Suites and test cases API', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  async function setup() {
    const owner = await signUp(t);
    const project = await createProject(owner.client);
    const target = await createShopbotTarget(owner.client, project.id);
    const suite = await createSuite(owner.client, project.id, { targetId: target.id, passThreshold: 0.8 });
    return { owner, project, target, suite };
  }

  describe('suites', () => {
    it('creates a suite linked to a target with defaults', async () => {
      const { suite, target } = await setup();
      expect(suite).toMatchObject({
        name: 'Core support',
        targetId: target.id,
        target: { id: target.id, name: 'ShopBot', type: 'SHOPBOT' },
        passThreshold: 0.8,
        caseCount: 0,
        lastRun: null,
      });
    });

    it('lists, updates and deletes suites', async () => {
      const { owner, project, suite } = await setup();
      const list = await owner.client.get(`/projects/${project.id}/suites`).expect(200);
      expect(list.body.items.map((s: SuiteResponse) => s.id)).toEqual([suite.id]);

      const updated = await owner.client
        .patch(`/suites/${suite.id}`, { name: 'Renamed', targetId: null })
        .expect(200);
      expect(updated.body).toMatchObject({ name: 'Renamed', targetId: null });

      await owner.client.delete(`/suites/${suite.id}`).expect(204);
      await owner.client.get(`/suites/${suite.id}`).expect(404);
    });

    it("rejects a target from another user's project", async () => {
      const { owner, project } = await setup();
      const other = await signUp(t);
      const otherProject = await createProject(other.client);
      const foreignTarget = await createShopbotTarget(other.client, otherProject.id);
      const res = await owner.client
        .post(`/projects/${project.id}/suites`, { name: 'x', targetId: foreignTarget.id })
        .expect(400);
      expect(res.body.message).toBe('Target not found in this project');
    });

    it('validates the pass threshold', async () => {
      const { owner, project } = await setup();
      await owner.client.post(`/projects/${project.id}/suites`, { name: 'x', passThreshold: 2 }).expect(400);
    });
  });

  describe('test cases', () => {
    it('creates cases in order and counts them on the suite', async () => {
      const { owner, suite } = await setup();
      const first = await createCase(owner.client, suite.id, { name: 'First' });
      const second = await createCase(owner.client, suite.id, { name: 'Second' });
      expect([first.position, second.position]).toEqual([0, 1]);

      const list = await owner.client.get(`/suites/${suite.id}/cases`).expect(200);
      expect(list.body.map((c: TestCaseResponse) => c.name)).toEqual(['First', 'Second']);
      const refreshed = await owner.client.get(`/suites/${suite.id}`).expect(200);
      expect(refreshed.body.caseCount).toBe(2);
    });

    it('stores every check type', async () => {
      const { owner, suite } = await setup();
      const checks = [
        { type: 'contains', value: '30 days', caseSensitive: true },
        { type: 'not_contains', value: 'password' },
        { type: 'equals', value: 'yes' },
        { type: 'regex', pattern: 'refund(s)?', flags: 'i' },
        { type: 'json_schema', schema: { type: 'object' } },
        { type: 'max_length', chars: 500 },
        { type: 'latency', maxMs: 2000 },
        { type: 'refusal', expected: false },
        { type: 'llm_judge', criteria: 'Polite and accurate', threshold: 7 },
      ];
      const created = await createCase(owner.client, suite.id, { checks });
      expect(created.checks).toEqual(checks);
    });

    it.each([
      ['no checks', { checks: [] }],
      ['an unknown check type', { checks: [{ type: 'vibes' }] }],
      ['a stateful regex flag', { checks: [{ type: 'regex', pattern: 'a', flags: 'g' }] }],
      ['an empty input', { input: '' }],
      ['an invalid tag', { tags: ['has space'] }],
    ])('rejects a case with %s', async (_label, body) => {
      const { owner, suite } = await setup();
      const res = await owner.client
        .post(`/suites/${suite.id}/cases`, {
          name: 'x',
          input: 'hi',
          checks: [{ type: 'contains', value: 'a' }],
          ...body,
        })
        .expect(400);
      expect(res.body.message).toBe('Validation failed');
    });

    it('stores script payloads as plain text (escaping is the renderer’s job)', async () => {
      const { owner, suite } = await setup();
      const xss = '<img src=x onerror=alert(1)><script>alert("xss")</script>';
      const created = await createCase(owner.client, suite.id, { name: xss, input: xss });
      expect(created.name).toBe(xss);
      const res = await owner.client.get(`/suites/${suite.id}/cases`).expect(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('updates and deletes a case', async () => {
      const { owner, suite } = await setup();
      const created = await createCase(owner.client, suite.id);
      const updated = await owner.client
        .patch(`/cases/${created.id}`, { name: 'Renamed', tags: ['regression'] })
        .expect(200);
      expect(updated.body).toMatchObject({ name: 'Renamed', tags: ['regression'], checks: created.checks });
      await owner.client.delete(`/cases/${created.id}`).expect(204);
      await owner.client.delete(`/cases/${created.id}`).expect(404);
    });

    it('reorders cases', async () => {
      const { owner, suite } = await setup();
      const a = await createCase(owner.client, suite.id, { name: 'A' });
      const b = await createCase(owner.client, suite.id, { name: 'B' });
      const c = await createCase(owner.client, suite.id, { name: 'C' });
      const res = await owner.client
        .post(`/suites/${suite.id}/cases/reorder`, { ids: [c.id, a.id, b.id] })
        .expect(200);
      expect(res.body.map((x: TestCaseResponse) => [x.name, x.position])).toEqual([
        ['C', 0],
        ['A', 1],
        ['B', 2],
      ]);
    });

    it('rejects a reorder that does not list every case exactly once', async () => {
      const { owner, suite } = await setup();
      const a = await createCase(owner.client, suite.id, { name: 'A' });
      await createCase(owner.client, suite.id, { name: 'B' });
      await owner.client.post(`/suites/${suite.id}/cases/reorder`, { ids: [a.id] }).expect(400);
      await owner.client
        .post(`/suites/${suite.id}/cases/reorder`, { ids: [a.id, 'someone-elses-case'] })
        .expect(400);
    });

    it(`stops at ${MAX_CASES_PER_SUITE} cases per suite`, async () => {
      const { owner, suite } = await setup();
      await t.prisma.testCase.createMany({
        data: Array.from({ length: MAX_CASES_PER_SUITE }, (_, position) => ({
          suiteId: suite.id,
          name: `Case ${position}`,
          input: 'hi',
          checksJson: [{ type: 'contains', value: 'a' }],
          tags: [],
          position,
        })),
      });
      const res = await owner.client
        .post(`/suites/${suite.id}/cases`, {
          name: 'One more',
          input: 'hi',
          checks: [{ type: 'contains', value: 'a' }],
        })
        .expect(400);
      expect(res.body.message).toContain(String(MAX_CASES_PER_SUITE));
    });
  });

  describe('CSV import and export', () => {
    it('exports the cases as a CSV download', async () => {
      const { owner, suite } = await setup();
      await createCase(owner.client, suite.id, { name: 'Refund, window', tags: ['smoke', 'refunds'] });
      const res = await owner.client.get(`/suites/${suite.id}/export.csv`).expect(200);
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toBe('attachment; filename="core-support-cases.csv"');
      expect(res.text.split('\r\n')[0]).toBe('name,input,checks,tags');
      expect(res.text).toContain('"Refund, window"');
      expect(res.text).toContain('smoke|refunds');
    });

    it('round-trips: export from one suite, import into another', async () => {
      const { owner, project, suite } = await setup();
      await createCase(owner.client, suite.id, { name: 'One' });
      await createCase(owner.client, suite.id, {
        name: 'Two',
        checks: [{ type: 'llm_judge', criteria: 'Is polite', threshold: 8 }],
      });
      const csv = (await owner.client.get(`/suites/${suite.id}/export.csv`).expect(200)).text;

      const copy = await createSuite(owner.client, project.id, { name: 'Copy' });
      const res = await owner.client.agent
        .post(`/api/suites/${copy.id}/import`)
        .set('Origin', t.config.webUrl)
        .set('Content-Type', 'text/csv')
        .send(csv)
        .expect(201);
      expect(res.body).toEqual({ imported: 2, errors: [] });

      const original = (await owner.client.get(`/suites/${suite.id}/cases`)).body as TestCaseResponse[];
      const imported = (await owner.client.get(`/suites/${copy.id}/cases`)).body as TestCaseResponse[];
      const strip = (c: TestCaseResponse) => ({
        name: c.name,
        input: c.input,
        checks: c.checks,
        tags: c.tags,
        position: c.position,
      });
      expect(imported.map(strip)).toEqual(original.map(strip));
    });

    it('imports valid rows, reports invalid ones and appends after existing cases', async () => {
      const { owner, suite } = await setup();
      await createCase(owner.client, suite.id, { name: 'Existing' });
      const csv = [
        'name,input,checks',
        'Good,Hello,"[{""type"":""contains"",""value"":""hi""}]"',
        'Bad,Hello,not-json',
      ].join('\n');
      const res = await owner.client.post(`/suites/${suite.id}/import`, { csv }).expect(201);
      expect(res.body).toEqual({ imported: 1, errors: [{ row: 3, message: 'checks: not valid JSON' }] });
      const cases = (await owner.client.get(`/suites/${suite.id}/cases`)).body as TestCaseResponse[];
      expect(cases.map((c) => [c.name, c.position])).toEqual([
        ['Existing', 0],
        ['Good', 1],
      ]);
    });

    it('rejects a request without a CSV body', async () => {
      const { owner, suite } = await setup();
      const res = await owner.client.post(`/suites/${suite.id}/import`, { nothing: true }).expect(400);
      expect(res.body.message).toContain('text/csv');
    });
  });

  describe('ownership (IDOR)', () => {
    it("returns 404 for another user's suites and cases", async () => {
      const { owner, project, suite } = await setup();
      const testCase = await createCase(owner.client, suite.id);
      const intruder = await signUp(t);
      const c = intruder.client;

      await c.get(`/projects/${project.id}/suites`).expect(404);
      await c.post(`/projects/${project.id}/suites`, { name: 'x' }).expect(404);
      await c.get(`/suites/${suite.id}`).expect(404);
      await c.patch(`/suites/${suite.id}`, { name: 'x' }).expect(404);
      await c.delete(`/suites/${suite.id}`).expect(404);
      await c.get(`/suites/${suite.id}/export.csv`).expect(404);
      await c.post(`/suites/${suite.id}/import`, { csv: 'name,input,checks\nA,B,[]' }).expect(404);
      await c.get(`/suites/${suite.id}/cases`).expect(404);
      await c
        .post(`/suites/${suite.id}/cases`, {
          name: 'x',
          input: 'y',
          checks: [{ type: 'contains', value: 'a' }],
        })
        .expect(404);
      await c.post(`/suites/${suite.id}/cases/reorder`, { ids: [testCase.id] }).expect(404);
      await c.patch(`/cases/${testCase.id}`, { name: 'Hacked' }).expect(404);
      await c.delete(`/cases/${testCase.id}`).expect(404);

      const still = await owner.client.get(`/suites/${suite.id}/cases`).expect(200);
      expect(still.body).toHaveLength(1);
    });
  });
});

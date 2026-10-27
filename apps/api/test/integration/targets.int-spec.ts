import type { TargetResponse } from '@evalpilot/shared';
import { TargetsService } from '../../src/targets/targets.service';
import { signUp } from '../utils/api-client';
import { createHttpTarget, createProject, createShopbotTarget, createSuite } from '../utils/fixtures';
import { createTestApp, type TestApp } from '../utils/test-app';

const SECRET = 'Bearer sk-live-1234567890abcdef';

describe('Targets API', () => {
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
    return { owner, project };
  }

  it('creates an HTTP target and never returns header secrets', async () => {
    const { owner, project } = await setup();
    const target = await createHttpTarget(owner.client, project.id);

    expect(target).toMatchObject({
      type: 'HTTP',
      url: 'https://bot.example.com/chat',
      method: 'POST',
      responsePath: '$.reply',
      headers: { Authorization: '••••••••cdef', 'X-Team': '••••••••' },
    });

    const listed = await owner.client.get(`/projects/${project.id}/targets`).expect(200);
    const fetched = await owner.client.get(`/targets/${target.id}`).expect(200);
    for (const body of [listed.body, fetched.body]) expect(JSON.stringify(body)).not.toContain('sk-live');
  });

  it('encrypts headers at rest', async () => {
    const { owner, project } = await setup();
    const target = await createHttpTarget(owner.client, project.id);
    const row = await t.prisma.target.findUniqueOrThrow({ where: { id: target.id } });
    expect(row.headersJson).toMatch(/^v1\./);
    expect(row.headersJson).not.toContain('sk-live');
  });

  it('keeps a secret header when the masked value is sent back unchanged', async () => {
    const { owner, project } = await setup();
    const target = await createHttpTarget(owner.client, project.id);
    await owner.client
      .patch(`/targets/${target.id}`, {
        headers: { ...target.headers, 'X-Team': 'billing' },
        timeoutMs: 5000,
      })
      .expect(200);

    const row = await t.prisma.target.findUniqueOrThrow({ where: { id: target.id } });
    expect(t.app.get(TargetsService).readHeaders(row)).toEqual({
      Authorization: SECRET,
      'X-Team': 'billing',
    });
    expect(row.timeoutMs).toBe(5000);
  });

  it('re-validates cross-field rules on update', async () => {
    const { owner, project } = await setup();
    const target = await createHttpTarget(owner.client, project.id);
    const res = await owner.client
      .patch(`/targets/${target.id}`, { bodyTemplate: '{"message":"hello"}' })
      .expect(400);
    expect(res.body.errors[0].path).toBe('bodyTemplate');
  });

  it('creates a ShopBot target whose URL comes from server config', async () => {
    const { owner, project } = await setup();
    const target = await createShopbotTarget(owner.client, project.id);
    expect(target).toMatchObject({ type: 'SHOPBOT', url: null, headers: {}, timeoutMs: 15000 });

    await owner.client.patch(`/targets/${target.id}`, { name: 'ShopBot v2' }).expect(200);
    const res = await owner.client
      .patch(`/targets/${target.id}`, { url: 'https://elsewhere.example' })
      .expect(400);
    expect(res.body.message).toContain('ShopBot');
  });

  it.each([
    ['missing {{input}} placeholder', { bodyTemplate: '{"q":"hi"}' }],
    ['a non-http URL', { url: 'file:///etc/passwd' }],
    ['credentials in the URL', { url: 'https://admin:pw@bot.example.com' }],
    ['an unknown type', { type: 'FTP' }],
  ])('rejects %s', async (_label, overrides) => {
    const { owner, project } = await setup();
    await owner.client
      .post(`/projects/${project.id}/targets`, {
        type: 'HTTP',
        name: 'Bad',
        url: 'https://bot.example.com',
        bodyTemplate: '{"q":"{{input}}"}',
        ...overrides,
      })
      .expect(400);
  });

  it('deleting a target unlinks its suites instead of deleting them', async () => {
    const { owner, project } = await setup();
    const target = await createShopbotTarget(owner.client, project.id);
    const suite = await createSuite(owner.client, project.id, { targetId: target.id });
    await owner.client.delete(`/targets/${target.id}`).expect(204);
    const res = await owner.client.get(`/suites/${suite.id}`).expect(200);
    expect(res.body).toMatchObject({ targetId: null, target: null });
  });

  describe('ownership (IDOR)', () => {
    it("returns 404 for another user's targets", async () => {
      const { owner, project } = await setup();
      const target: TargetResponse = await createHttpTarget(owner.client, project.id);
      const intruder = await signUp(t);
      await intruder.client.get(`/projects/${project.id}/targets`).expect(404);
      await intruder.client
        .post(`/projects/${project.id}/targets`, { type: 'SHOPBOT', name: 'x' })
        .expect(404);
      await intruder.client.get(`/targets/${target.id}`).expect(404);
      await intruder.client.patch(`/targets/${target.id}`, { name: 'Hacked' }).expect(404);
      await intruder.client.delete(`/targets/${target.id}`).expect(404);
    });
  });
});

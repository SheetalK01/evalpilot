import { createHash } from 'node:crypto';
import type { ApiKeyResponse, CreatedApiKeyResponse } from '@evalpilot/shared';
import { ApiKeysService } from '../../src/api-keys/api-keys.service';
import { signUp } from '../utils/api-client';
import { createProject } from '../utils/fixtures';
import { createTestApp, type TestApp } from '../utils/test-app';

describe('API keys API', () => {
  let t: TestApp;
  let apiKeys: ApiKeysService;

  beforeAll(async () => {
    t = await createTestApp();
    apiKeys = t.app.get(ApiKeysService);
  });

  afterAll(async () => {
    await t.close();
  });

  async function setup() {
    const owner = await signUp(t);
    const project = await createProject(owner.client);
    const created = await owner.client.post(`/projects/${project.id}/api-keys`, { name: 'CI' }).expect(201);
    return { owner, project, key: created.body as CreatedApiKeyResponse };
  }

  it('shows the raw key once and stores only its SHA-256 hash', async () => {
    const { key } = await setup();
    expect(key.key).toMatch(/^ep_live_[A-Za-z0-9_-]{32}$/);
    expect(key.prefix).toBe(key.key.slice(0, 12));

    const stored = await t.prisma.apiKey.findUniqueOrThrow({ where: { id: key.id } });
    expect(stored.keyHash).toBe(createHash('sha256').update(key.key).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(key.key);
  });

  it('lists keys without the secret', async () => {
    const { owner, project, key } = await setup();
    const res = await owner.client.get(`/projects/${project.id}/api-keys`).expect(200);
    const listed = res.body as ApiKeyResponse[];
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: key.id, name: 'CI', prefix: key.prefix, revokedAt: null });
    expect(JSON.stringify(res.body)).not.toContain(key.key);
  });

  it('authenticates a valid key and records when it was used', async () => {
    const { project, key } = await setup();
    const context = await apiKeys.authenticate(key.key);
    expect(context).toMatchObject({ apiKeyId: key.id, projectId: project.id });
    const stored = await t.prisma.apiKey.findUniqueOrThrow({ where: { id: key.id } });
    expect(stored.lastUsedAt).not.toBeNull();
  });

  it.each([
    ['malformed', 'not-a-key'],
    ['unknown', `ep_live_${'x'.repeat(32)}`],
  ])('rejects a %s key', async (_label, raw) => {
    expect(await apiKeys.authenticate(raw)).toBeNull();
  });

  it('revokes a key (idempotently) so it no longer authenticates', async () => {
    const { owner, key } = await setup();
    await owner.client.delete(`/api-keys/${key.id}`).expect(204);
    const first = await t.prisma.apiKey.findUniqueOrThrow({ where: { id: key.id } });
    expect(first.revokedAt).not.toBeNull();

    await owner.client.delete(`/api-keys/${key.id}`).expect(204);
    const second = await t.prisma.apiKey.findUniqueOrThrow({ where: { id: key.id } });
    expect(second.revokedAt).toEqual(first.revokedAt);

    expect(await apiKeys.authenticate(key.key)).toBeNull();
  });

  it('validates the key name', async () => {
    const owner = await signUp(t);
    const project = await createProject(owner.client);
    await owner.client.post(`/projects/${project.id}/api-keys`, { name: '' }).expect(400);
  });

  describe('ownership (IDOR)', () => {
    it("cannot list, create or revoke keys in another user's project", async () => {
      const { project, key } = await setup();
      const intruder = await signUp(t);
      await intruder.client.get(`/projects/${project.id}/api-keys`).expect(404);
      await intruder.client.post(`/projects/${project.id}/api-keys`, { name: 'Mine now' }).expect(404);
      await intruder.client.delete(`/api-keys/${key.id}`).expect(404);
      expect(await apiKeys.authenticate(key.key)).not.toBeNull();
    });
  });
});

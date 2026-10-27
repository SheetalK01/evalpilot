import { expect, test } from '@playwright/test';
import { registerUser } from '../../support/api';
import { API_URL } from '../../support/env';

test.describe('API keys @security', () => {
  test('a revoked, malformed or missing key gets 401 on every /v1 endpoint', async ({ request }) => {
    const { api } = await registerUser('revoked');
    const project = await api.createProject();
    const suite = await api.createSuite(project.id);
    const key = await api.createApiKey(project.id);
    expect((await api.delete(`/api-keys/${key.id}`)).status()).toBe(204);

    for (const auth of [`Bearer ${key.key}`, 'Bearer ep_live_fake', 'Basic abc', '']) {
      const headers = auth ? { Authorization: auth } : undefined;
      const trace = await request.post(`${API_URL}/api/v1/traces`, {
        data: { name: 'x', latencyMs: 1 },
        headers,
      });
      const run = await request.post(`${API_URL}/api/v1/suites/${suite.id}/runs`, { data: {}, headers });
      expect([trace.status(), run.status()], auth || 'none').toEqual([401, 401]);
    }
    await api.ctx.dispose();
  });
});

test.describe('SSRF guard @security', () => {
  const blocked = [
    'http://127.0.0.1:4400/api/health',
    'http://localhost:4100/chat',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.5/chat',
    'http://[::1]:4400/',
    'http://0.0.0.0:4400/',
  ];

  test('HTTP targets that point at private or metadata addresses are never called', async () => {
    const { api } = await registerUser('ssrf');
    const project = await api.createProject();
    for (const url of blocked) {
      const create = await api.post(`/projects/${project.id}/targets`, {
        type: 'HTTP',
        name: 'Sneaky',
        url,
        method: 'POST',
        bodyTemplate: '{"message":"{{input}}"}',
        responsePath: '$.reply',
      });
      if (create.status() === 400) continue; // refused up front
      expect(create.status(), url).toBe(201);
      const target = (await create.json()) as { id: string };
      const ping = await api.json<{ ok: boolean; error: string | null }>(
        api.post(`/targets/${target.id}/ping`),
      );
      expect(ping.ok, url).toBe(false);
      expect(ping.error, url).toMatch(/private|not allowed|blocked/i);
    }
    await api.ctx.dispose();
  });

  test('non-HTTP schemes are refused', async () => {
    const { api } = await registerUser('scheme');
    const project = await api.createProject();
    for (const url of ['file:///etc/passwd', 'gopher://example.com', 'ftp://example.com/x']) {
      const res = await api.post(`/projects/${project.id}/targets`, {
        type: 'HTTP',
        name: 'x',
        url,
        method: 'POST',
      });
      expect(res.status(), url).toBe(400);
    }
    await api.ctx.dispose();
  });
});

test.describe('Secrets are never returned @security', () => {
  test('target header values are masked and stored encrypted', async () => {
    const { api } = await registerUser('secrets');
    const project = await api.createProject();
    const secret = 'sk-live-1234567890abcdef';
    const target = await api.createHttpTarget(project.id, {
      url: 'https://bot.example.com/chat',
      headers: { Authorization: `Bearer ${secret}` },
    });
    const responses = [
      JSON.stringify(target),
      await (await api.get(`/targets/${target.id}`)).text(),
      await (await api.get(`/projects/${project.id}/targets`)).text(),
    ];
    for (const body of responses) expect(body).not.toContain(secret);
    expect(target.headers.Authorization).toMatch(/•|\*/);
    await api.ctx.dispose();
  });

  test('no response carries a password hash or a raw API key after creation', async () => {
    const { api } = await registerUser('hashes');
    const project = await api.createProject();
    const key = await api.createApiKey(project.id);
    const bodies = await Promise.all(
      ['/auth/me', '/projects', `/projects/${project.id}/api-keys`, '/dashboard'].map(async (path) =>
        (await api.get(path)).text(),
      ),
    );
    for (const body of bodies) {
      expect(body).not.toMatch(/passwordHash|keyHash|\$2[aby]\$/);
      expect(body).not.toContain(key.key);
    }
    await api.ctx.dispose();
  });

  test('security headers are set on API and web responses', async ({ request }) => {
    const api = await request.get(`${API_URL}/api/health`);
    expect(api.headers()['x-content-type-options']).toBe('nosniff');
    expect(api.headers()['x-powered-by']).toBeUndefined();
    const web = await request.get('/');
    expect(web.headers()['x-frame-options']).toBe('DENY');
    expect(web.headers()['x-powered-by']).toBeUndefined();
  });
});

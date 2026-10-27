import {
  apiKeySchema,
  createdApiKeySchema,
  healthSchema,
  paginatedSchema,
  projectSchema,
  publicUserSchema,
  runSchema,
  suiteSchema,
  targetSchema,
  testCaseSchema,
  testResultSchema,
} from '@evalpilot/shared';
import { expect, test } from '@playwright/test';
import { Api, newContext, registerUser, shopbotWorkspace } from '../../support/api';
import { expectApiError, expectSchema } from '../../support/schemas';

test.describe('REST API: status codes and response schemas @api', () => {
  test('health is public and reports every dependency @smoke', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    expect(expectSchema(healthSchema, await res.json()).checks).toEqual({
      api: 'up',
      db: 'up',
      redis: 'up',
      worker: 'up',
    });
    expect(res.headers()['x-request-id']).toBeTruthy();
  });

  test('register 201 → me 200 → logout 204 → me 401 @smoke', async () => {
    const { api, email } = await registerUser('contract');
    const me = expectSchema(publicUserSchema, await api.json(api.get('/auth/me')));
    expect(me.email).toBe(email);
    expect(me).not.toHaveProperty('passwordHash');
    expect((await api.post('/auth/logout')).status()).toBe(204);
    expect((await api.get('/auth/me')).status()).toBe(401);
    await api.ctx.dispose();
  });

  test('every resource of a workspace matches its schema @regression', async () => {
    const { api } = await registerUser('schemas');
    const { project, target, suite, cases } = await shopbotWorkspace(api, 2);
    expectSchema(projectSchema, project);
    expectSchema(targetSchema, target);
    expectSchema(suiteSchema, suite);
    for (const c of cases) expectSchema(testCaseSchema, c);

    const created = expectSchema(createdApiKeySchema, await api.createApiKey(project.id));
    const keys = await api.json<unknown[]>(api.get(`/projects/${project.id}/api-keys`));
    for (const key of keys) expectSchema(apiKeySchema, key);
    expect(JSON.stringify(keys)).not.toContain(created.key);

    const { runId } = await api.startRun(suite.id);
    const run = expectSchema(runSchema, await api.waitForRun(runId));
    expect(run.total).toBe(2);
    const results = await api.json<unknown[]>(api.get(`/runs/${runId}/results`));
    expect(results).toHaveLength(2);
    for (const result of results) expectSchema(testResultSchema, result);
    await api.ctx.dispose();
  });

  test('cursor pagination walks every page exactly once @regression', async () => {
    const { api } = await registerUser('pages');
    const names = ['P1', 'P2', 'P3', 'P4', 'P5'];
    for (const name of names) await api.createProject(name);

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const query: string = cursor ? `?limit=2&cursor=${cursor}` : '?limit=2';
      const page = expectSchema(paginatedSchema(projectSchema), await api.json(api.get(`/projects${query}`)));
      expect(page.items.length).toBeLessThanOrEqual(2);
      seen.push(...page.items.map((p) => p.name));
      cursor = page.nextCursor;
      pages++;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(seen.sort()).toEqual(names);

    const tooBig = await api.get('/projects?limit=1000');
    expect(tooBig.status()).toBe(400);
    await api.ctx.dispose();
  });
});

test.describe('REST API: errors @api', () => {
  test('401 without a session, in the standard error format @smoke', async ({ request }) => {
    const res = await request.get('/api/projects');
    expect(res.status()).toBe(401);
    expectApiError(await res.json(), 401);
  });

  test('400 lists every validation problem by field @regression', async () => {
    const { api } = await registerUser('validation');
    const project = await api.createProject();
    const res = await api.post(`/projects/${project.id}/suites`, { name: '', passThreshold: 2 });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { errors: { path: string }[] };
    expectApiError(body, 400);
    expect(body.errors.map((e) => e.path).sort()).toEqual(['name', 'passThreshold']);
    await api.ctx.dispose();
  });

  test('404 for unknown routes and unknown ids @regression', async () => {
    const { api } = await registerUser('missing');
    const unknownRoute = await api.get('/does-not-exist');
    expect(unknownRoute.status()).toBe(404);
    expectApiError(await unknownRoute.json(), 404);
    const unknownId = await api.get('/projects/clxxxxxxxxxxxxxxxxxxxxxxx');
    expect(unknownId.status()).toBe(404);
    await api.ctx.dispose();
  });

  test('cookie mutations from another origin are refused (CSRF) @security', async () => {
    const { api } = await registerUser('csrf');
    const res = await api.post('/projects', { name: 'Evil' }, { Origin: 'https://evil.example.com' });
    expect(res.status()).toBe(403);
    expectApiError(await res.json(), 403);
    await api.ctx.dispose();
  });

  test('rejects oversized bodies with 413 @security', async () => {
    const { api } = await registerUser('size');
    const project = await api.createProject();
    const suite = await api.createSuite(project.id);
    const res = await api.post(`/suites/${suite.id}/cases`, {
      name: 'Huge',
      input: 'x'.repeat(3 * 1024 * 1024),
      checks: [{ type: 'contains', value: 'a' }],
    });
    expect(res.status()).toBe(413);
    await api.ctx.dispose();
  });
});

test.describe('REST API: rate limits @api @security', () => {
  test('login attempts are limited per IP + email and answer 429 with Retry-After', async () => {
    const ctx = await newContext();
    const api = new Api(ctx);
    const email = `ratelimit-${Date.now()}@example.com`;
    const statuses: number[] = [];
    let retryAfter: string | undefined;
    for (let attempt = 0; attempt < 12; attempt++) {
      const res = await api.post('/auth/login', { email, password: 'wrong-passw0rd' });
      statuses.push(res.status());
      if (res.status() === 429) {
        // @nestjs/throttler names the header after the bucket (Retry-After-auth).
        retryAfter = Object.entries(res.headers()).find(([name]) => name.startsWith('retry-after'))?.[1];
        expectApiError(await res.json(), 429);
        break;
      }
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    expect(Number(retryAfter)).toBeGreaterThan(0);

    // A different email from the same IP is not locked out.
    const other = await api.post('/auth/login', { email: `other-${email}`, password: 'wrong-passw0rd' });
    expect(other.status()).toBe(401);
    await ctx.dispose();
  });
});

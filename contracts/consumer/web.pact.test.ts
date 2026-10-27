import { MatchersV3, PactV3 } from '@pact-foundation/pact';
import { beforeAll, describe, expect, it } from 'vitest';
import type * as WebApi from '../../apps/web/src/lib/api';
import { PACT_DIR, PACT_KEY_ID, PACT_PROJECT_ID, PROVIDER, WEB_PACT_PORT } from '../pact.config';

const { eachLike, like, regex } = MatchersV3;

/**
 * The web app ↔ API key endpoints, through the web app's real `api()` client. The browser sends
 * the session cookie and Origin itself, so the contract leaves them out; the provider
 * verification adds a valid session for the pact user.
 */
const provider = new PactV3({
  consumer: 'evalpilot-web',
  provider: PROVIDER,
  dir: PACT_DIR,
  port: WEB_PACT_PORT,
  logLevel: 'warn',
});

const isoDate = (example: string) => regex('^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$', example);
const keyShape = {
  id: like(PACT_KEY_ID),
  name: like('GitHub Actions'),
  prefix: regex('^ep_live_[A-Za-z0-9_-]{4}$', 'ep_live_abcd'),
  lastUsedAt: null,
  revokedAt: null,
  createdAt: isoDate('2026-10-27T10:00:00.000Z'),
};

let web: typeof WebApi;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${WEB_PACT_PORT}`;
  web = await import('../../apps/web/src/lib/api');
});

describe('Web → API keys', () => {
  it('lists the keys of a project, prefix only', async () => {
    provider
      .given('a signed-in user with a project and an API key', { projectId: PACT_PROJECT_ID })
      .uponReceiving('a request from the web app for the API keys of a project')
      .withRequest({ method: 'GET', path: `/api/projects/${PACT_PROJECT_ID}/api-keys` })
      .willRespondWith({ status: 200, body: eachLike(keyShape) });

    await provider.executeTest(async () => {
      const keys = await web.api<{ prefix: string; key?: string }[]>(`/projects/${PACT_PROJECT_ID}/api-keys`);
      expect(keys[0]?.prefix).toMatch(/^ep_live_/);
      expect(keys[0]).not.toHaveProperty('key');
    });
  });

  it('creates a key and receives the raw value once', async () => {
    provider
      .given('a signed-in user with a project and an API key', { projectId: PACT_PROJECT_ID })
      .uponReceiving('a request from the web app to create an API key')
      .withRequest({
        method: 'POST',
        path: `/api/projects/${PACT_PROJECT_ID}/api-keys`,
        headers: { 'content-type': 'application/json' },
        body: { name: 'GitHub Actions' },
      })
      .willRespondWith({
        status: 201,
        body: { ...keyShape, key: regex('^ep_live_[A-Za-z0-9_-]{32}$', `ep_live_${'a'.repeat(32)}`) },
      });

    await provider.executeTest(async () => {
      const created = await web.api<{ key: string }>(`/projects/${PACT_PROJECT_ID}/api-keys`, {
        method: 'POST',
        body: { name: 'GitHub Actions' },
      });
      expect(created.key).toMatch(/^ep_live_/);
    });
  });

  it('revokes a key (204)', async () => {
    provider
      .given('a signed-in user with a project and an API key', { projectId: PACT_PROJECT_ID })
      .uponReceiving('a request from the web app to revoke an API key')
      .withRequest({ method: 'DELETE', path: `/api/api-keys/${PACT_KEY_ID}` })
      .willRespondWith({ status: 204 });

    await provider.executeTest(async () => {
      await expect(web.api(`/api-keys/${PACT_KEY_ID}`, { method: 'DELETE' })).resolves.toBeUndefined();
    });
  });

  it('gets the standard error body for a project it cannot see', async () => {
    provider
      .given('a signed-in user with a project and an API key', { projectId: PACT_PROJECT_ID })
      .uponReceiving('a request from the web app for the keys of an unknown project')
      .withRequest({ method: 'GET', path: '/api/projects/someone-elses-project/api-keys' })
      .willRespondWith({
        status: 404,
        body: {
          statusCode: 404,
          message: like('Project not found'),
          path: like('/api/projects/someone-elses-project/api-keys'),
          requestId: like('3f1c3a9e-5d1b-4a63-9f7e-1a2b3c4d5e6f'),
          timestamp: isoDate('2026-10-27T10:00:00.000Z'),
        },
      });

    await provider.executeTest(async () => {
      await expect(web.api('/projects/someone-elses-project/api-keys')).rejects.toMatchObject({
        status: 404,
        requestId: expect.any(String) as string,
      });
    });
  });
});

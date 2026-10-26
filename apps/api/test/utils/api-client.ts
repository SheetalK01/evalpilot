import { randomUUID } from 'node:crypto';
import type { PublicUserResponse } from '@evalpilot/shared';
import request from 'supertest';
import type { TestApp } from './test-app';

type Agent = ReturnType<typeof request.agent>;

/**
 * A browser-like client: keeps the session cookie between calls and sends an allowed Origin on
 * state-changing requests (like the web app does), so the CSRF check passes.
 */
export class ApiClient {
  readonly agent: Agent;

  constructor(
    private readonly testApp: TestApp,
    private readonly origin = testApp.config.webUrl,
  ) {
    this.agent = request.agent(testApp.server);
  }

  get(path: string) {
    return this.agent.get(`/api${path}`);
  }

  post(path: string, body?: string | object) {
    return this.agent.post(`/api${path}`).set('Origin', this.origin).send(body);
  }

  patch(path: string, body?: object) {
    return this.agent.patch(`/api${path}`).set('Origin', this.origin).send(body);
  }

  delete(path: string) {
    return this.agent.delete(`/api${path}`).set('Origin', this.origin);
  }
}

export const uniqueEmail = (label = 'qa') => `${label}-${randomUUID()}@test.evalpilot.dev`;
export const TEST_PASSWORD = 'Sup3r-secret-pass';

export interface SignedUpUser {
  client: ApiClient;
  user: PublicUserResponse;
  email: string;
  password: string;
}

/** Registers a brand-new user (unique email), so tests never share data and can run in parallel. */
export async function signUp(testApp: TestApp, name = 'QA Pilot'): Promise<SignedUpUser> {
  const client = new ApiClient(testApp);
  const email = uniqueEmail();
  const res = await client.post('/auth/register', { name, email, password: TEST_PASSWORD }).expect(201);
  return { client, user: res.body as PublicUserResponse, email, password: TEST_PASSWORD };
}

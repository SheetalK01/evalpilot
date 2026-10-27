import { randomUUID } from 'node:crypto';
import { type APIRequestContext, type APIResponse, expect, request } from '@playwright/test';
import {
  SHOPBOT_DEMO_CASES,
  type CreatedApiKeyResponse,
  type ProjectResponse,
  type PublicUserResponse,
  type RedteamCreatedResponse,
  type RedteamReportResponse,
  type RunCreatedResponse,
  type RunResponse,
  type SuiteResponse,
  type TargetResponse,
  type TestCaseResponse,
} from '@evalpilot/shared';
import { API_URL, WEB_URL } from './env';

export const PASSWORD = 'e2e-Passw0rd!';

/** A unique, valid email for one test (parallel-safe). */
export function uniqueEmail(tag = 'user'): string {
  return `e2e-${tag}-${randomUUID().slice(0, 12)}@example.com`;
}

type Body = Record<string, unknown> | unknown[];

/**
 * Thin client over Playwright's request context for `/api`. Cookie-authenticated mutations send
 * the web app's Origin, exactly like the browser does (the API's CSRF check requires it).
 */
export class Api {
  constructor(
    readonly ctx: APIRequestContext,
    private readonly bearer?: string,
  ) {}

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Origin: WEB_URL,
      ...(this.bearer ? { Authorization: `Bearer ${this.bearer}` } : {}),
      ...extra,
    };
  }

  get(path: string, headers?: Record<string, string>): Promise<APIResponse> {
    return this.ctx.get(`/api${path}`, { headers: this.headers(headers) });
  }

  post(path: string, data: Body = {}, headers?: Record<string, string>): Promise<APIResponse> {
    return this.ctx.post(`/api${path}`, { data, headers: this.headers(headers) });
  }

  patch(path: string, data: Body, headers?: Record<string, string>): Promise<APIResponse> {
    return this.ctx.patch(`/api${path}`, { data, headers: this.headers(headers) });
  }

  delete(path: string, headers?: Record<string, string>): Promise<APIResponse> {
    return this.ctx.delete(`/api${path}`, { headers: this.headers(headers) });
  }

  /** Sends the request and returns its JSON body after checking the status. */
  async json<T>(response: Promise<APIResponse>, status = 200): Promise<T> {
    const res = await response;
    expect(res.status(), `${res.url()} → ${await res.text()}`).toBe(status);
    return (await res.json()) as T;
  }

  // ── Workspace builders ────────────────────────────────────────────────────

  createProject(name = 'E2E project'): Promise<ProjectResponse> {
    return this.json(this.post('/projects', { name, description: 'Created by an E2E test' }), 201);
  }

  createShopbotTarget(projectId: string, name = 'ShopBot'): Promise<TargetResponse> {
    return this.json(this.post(`/projects/${projectId}/targets`, { type: 'SHOPBOT', name }), 201);
  }

  createHttpTarget(projectId: string, body: Record<string, unknown>): Promise<TargetResponse> {
    return this.json(
      this.post(`/projects/${projectId}/targets`, {
        type: 'HTTP',
        name: 'HTTP bot',
        method: 'POST',
        bodyTemplate: '{"message":"{{input}}"}',
        responsePath: '$.reply',
        timeoutMs: 5000,
        ...body,
      }),
      201,
    );
  }

  createSuite(projectId: string, body: Record<string, unknown> = {}): Promise<SuiteResponse> {
    return this.json(this.post(`/projects/${projectId}/suites`, { name: 'E2E suite', ...body }), 201);
  }

  createCase(suiteId: string, body: Record<string, unknown> = {}): Promise<TestCaseResponse> {
    return this.json(
      this.post(`/suites/${suiteId}/cases`, {
        name: 'Refund window',
        input: 'Can I return a jacket after two weeks?',
        checks: [{ type: 'contains', value: '30 days' }],
        ...body,
      }),
      201,
    );
  }

  createApiKey(projectId: string, name = 'E2E key'): Promise<CreatedApiKeyResponse> {
    return this.json(this.post(`/projects/${projectId}/api-keys`, { name }), 201);
  }

  startRun(suiteId: string): Promise<RunCreatedResponse> {
    return this.json(this.post(`/suites/${suiteId}/runs`), 202);
  }

  startRedteam(targetId: string, categories?: string[]): Promise<RedteamCreatedResponse> {
    return this.json(this.post(`/targets/${targetId}/redteam`, categories ? { categories } : {}), 202);
  }

  async waitForRedteam(id: string): Promise<RedteamReportResponse> {
    let report: RedteamReportResponse | undefined;
    await expect
      .poll(
        async () => {
          report = await this.json<RedteamReportResponse>(this.get(`/redteam-runs/${id}`));
          return ['COMPLETED', 'ERROR', 'CANCELLED'].includes(report.status);
        },
        { timeout: 30_000, intervals: [250, 500, 1000] },
      )
      .toBe(true);
    if (!report) throw new Error('unreachable');
    return report;
  }

  /** Polls until the run reaches a final status (the worker runs asynchronously). */
  async waitForRun(runId: string): Promise<RunResponse> {
    let run: RunResponse | undefined;
    await expect
      .poll(
        async () => {
          run = await this.json<RunResponse>(this.get(`/runs/${runId}`));
          return ['PASSED', 'FAILED', 'ERROR', 'CANCELLED'].includes(run.status);
        },
        { timeout: 30_000, intervals: [250, 500, 1000] },
      )
      .toBe(true);
    if (!run) throw new Error('unreachable');
    return run;
  }
}

export interface Session {
  api: Api;
  user: PublicUserResponse;
  email: string;
  password: string;
}

/** A fresh request context that keeps cookies, pointed at the E2E API. */
export function newContext(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: API_URL });
}

/** Registers a brand-new user and returns a cookie-authenticated client for them. */
export async function registerUser(tag = 'user'): Promise<Session> {
  const ctx = await newContext();
  const api = new Api(ctx);
  const email = uniqueEmail(tag);
  const user = await api.json<PublicUserResponse>(
    api.post('/auth/register', { name: `E2E ${tag}`, email, password: PASSWORD }),
    201,
  );
  return { api, user, email, password: PASSWORD };
}

/** A workspace with a ShopBot target and a suite of cases that pass against the mock brain. */
export async function shopbotWorkspace(api: Api, cases = 3) {
  const project = await api.createProject();
  const target = await api.createShopbotTarget(project.id);
  const suite = await api.createSuite(project.id, { targetId: target.id, passThreshold: 0.6 });
  const created: TestCaseResponse[] = [];
  for (const demo of SHOPBOT_DEMO_CASES.slice(0, cases))
    created.push(await api.createCase(suite.id, { ...demo }));
  return { project, target, suite, cases: created };
}

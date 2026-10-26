import type { ProjectResponse, SuiteResponse, TargetResponse, TestCaseResponse } from '@evalpilot/shared';
import type { ApiClient } from './api-client';

export async function createProject(
  client: ApiClient,
  name = 'ShopSphere Support',
): Promise<ProjectResponse> {
  const res = await client
    .post('/projects', { name, description: 'Created by an integration test' })
    .expect(201);
  return res.body as ProjectResponse;
}

export async function createHttpTarget(
  client: ApiClient,
  projectId: string,
  overrides: object = {},
): Promise<TargetResponse> {
  const res = await client
    .post(`/projects/${projectId}/targets`, {
      type: 'HTTP',
      name: 'Prod bot',
      url: 'https://bot.example.com/chat',
      method: 'POST',
      headers: { Authorization: 'Bearer sk-live-1234567890abcdef', 'X-Team': 'support' },
      bodyTemplate: '{"message":"{{input}}"}',
      responsePath: '$.reply',
      timeoutMs: 10000,
      ...overrides,
    })
    .expect(201);
  return res.body as TargetResponse;
}

export async function createShopbotTarget(client: ApiClient, projectId: string): Promise<TargetResponse> {
  const res = await client
    .post(`/projects/${projectId}/targets`, { type: 'SHOPBOT', name: 'ShopBot' })
    .expect(201);
  return res.body as TargetResponse;
}

export async function createSuite(
  client: ApiClient,
  projectId: string,
  body: object = {},
): Promise<SuiteResponse> {
  const res = await client
    .post(`/projects/${projectId}/suites`, { name: 'Core support', ...body })
    .expect(201);
  return res.body as SuiteResponse;
}

export async function createCase(
  client: ApiClient,
  suiteId: string,
  body: object = {},
): Promise<TestCaseResponse> {
  const res = await client
    .post(`/suites/${suiteId}/cases`, {
      name: 'Refund window',
      input: 'Can I return a jacket after two weeks?',
      checks: [{ type: 'contains', value: '30 days' }],
      tags: ['smoke'],
      ...body,
    })
    .expect(201);
  return res.body as TestCaseResponse;
}

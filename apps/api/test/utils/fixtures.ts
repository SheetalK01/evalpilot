import type { Prisma } from '@prisma/client';
import {
  ATTACK_LIBRARY,
  type ProjectResponse,
  type SuiteResponse,
  type TargetResponse,
  type TestCaseResponse,
} from '@evalpilot/shared';
import type { PrismaService } from '@evalpilot/server-core';
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

/** The seeded attack library (upserted, so parallel test files can share it). */
export async function ensureAttacks(prisma: PrismaService): Promise<void> {
  for (const attack of ATTACK_LIBRARY) {
    const data = {
      category: attack.category,
      prompt: attack.prompt,
      severity: attack.severity,
      detectionJson: attack.detection as Prisma.InputJsonValue,
    };
    await prisma.attack.upsert({
      where: { name: attack.name },
      update: {},
      create: { name: attack.name, ...data },
    });
  }
}

/** Stores a finished run with the given result statuses, as the worker would. */
export async function seedFinishedRun(
  prisma: PrismaService,
  suiteId: string,
  statuses: ('PASSED' | 'FAILED' | 'ERROR')[],
  caseIds: string[],
) {
  const passed = statuses.filter((s) => s === 'PASSED').length;
  return prisma.testRun.create({
    data: {
      suiteId,
      status: passed / statuses.length >= 0.9 ? 'PASSED' : 'FAILED',
      total: statuses.length,
      passed,
      failed: statuses.length - passed,
      passRate: passed / statuses.length,
      startedAt: new Date(),
      finishedAt: new Date(),
      results: {
        create: statuses.map((status, position) => ({
          testCaseId: caseIds[position] ?? null,
          caseName: `Case ${position + 1}`,
          position,
          status,
          output: `answer ${position + 1}`,
          latencyMs: 100 + position,
          checkResultsJson: [{ type: 'contains', passed: status === 'PASSED', message: 'demo' }],
        })),
      },
    },
  });
}

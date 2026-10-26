import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { ATTACK_LIBRARY, type Check } from '@evalpilot/shared';
import type { PrismaService, SecretBox } from '@evalpilot/server-core';

export interface CaseSpec {
  name: string;
  input: string;
  checks: Check[];
}

/** Creates a user → project → HTTP target → suite with cases, directly in the test DB. */
export async function createRunFixture(
  prisma: PrismaService,
  options: {
    targetUrl: string;
    cases: CaseSpec[];
    passThreshold?: number;
    headers?: Record<string, string>;
    secrets?: SecretBox;
  },
) {
  const user = await prisma.user.create({
    data: { name: 'Worker QA', email: `worker-${randomUUID()}@test.evalpilot.dev` },
  });
  const project = await prisma.project.create({ data: { ownerId: user.id, name: 'Worker tests' } });
  const target = await prisma.target.create({
    data: {
      projectId: project.id,
      name: 'Fake bot',
      type: 'HTTP',
      url: `${options.targetUrl}/chat`,
      method: 'POST',
      bodyTemplate: '{"message":"{{input}}"}',
      responsePath: '$.reply',
      timeoutMs: 2000,
      headersJson:
        options.headers && options.secrets ? options.secrets.seal(JSON.stringify(options.headers)) : null,
    },
  });
  const suite = await prisma.testSuite.create({
    data: {
      projectId: project.id,
      targetId: target.id,
      name: 'Worker suite',
      passThreshold: options.passThreshold ?? 0.9,
      cases: {
        create: options.cases.map((c, position) => ({
          name: c.name,
          input: c.input,
          checksJson: c.checks as Prisma.InputJsonValue,
          tags: [],
          position,
        })),
      },
    },
  });
  const run = await prisma.testRun.create({
    data: { suiteId: suite.id, status: 'QUEUED', total: options.cases.length },
  });
  return { user, project, target, suite, run };
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

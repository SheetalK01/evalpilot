import 'reflect-metadata';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import type * as NestCore from '@nestjs/core';
import type * as ServerCore from '@evalpilot/server-core';
import { Verifier } from '@pact-foundation/pact';
import type { PrismaClient } from '@prisma/client';
import { config as loadDotenv } from 'dotenv';
import { afterAll, beforeAll, describe, it } from 'vitest';
import type * as AppSetup from '../../apps/api/src/app.setup';
import { PACT_API_KEY, PACT_DIR, PACT_RUN_ID, PACT_SUITE_ID, PROVIDER } from '../pact.config';

const REPO = resolve(__dirname, '../..');
const requireApi = createRequire(resolve(REPO, 'apps/api/dist/main.js'));

/** Same rules as the API integration tests: TEST database, mock AI, unique Redis namespace. */
function useTestEnvironment(): void {
  if (existsSync(resolve(REPO, '.env'))) loadDotenv({ path: resolve(REPO, '.env'), quiet: true });
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl?.includes('_test')) throw new Error('TEST_DATABASE_URL must point to the test database');
  Object.assign(process.env, {
    DATABASE_URL: testUrl,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    AI_MODE: 'mock',
    REDIS_PREFIX: `evalpilot-pact-${randomBytes(4).toString('hex')}`,
    RATE_LIMIT_DEFAULT: '100000',
  });
}

describe('Provider verification: evalpilot-api honours its consumers’ contracts', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let baseUrl: string;

  beforeAll(async () => {
    useTestEnvironment();
    // The compiled API (decorator metadata intact), exactly as it runs in production.
    const { NestFactory } = requireApi('@nestjs/core') as typeof NestCore;
    const { AppModule } = requireApi('./app.module') as { AppModule: new () => unknown };
    const { configureApp } = requireApi('./app.setup') as typeof AppSetup;
    const { APP_CONFIG, PrismaService } = requireApi('@evalpilot/server-core') as typeof ServerCore;
    app = await NestFactory.create(AppModule, { bodyParser: false, logger: false });
    configureApp(app, app.get(APP_CONFIG));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Fixed ids from the contracts; recreated for every interaction so states never leak. */
  async function resetPactData(): Promise<{ projectId: string }> {
    await prisma.user.deleteMany({ where: { email: 'pact@test.evalpilot.dev' } });
    const user = await prisma.user.create({ data: { name: 'Pact', email: 'pact@test.evalpilot.dev' } });
    const project = await prisma.project.create({ data: { ownerId: user.id, name: 'Pact project' } });
    await prisma.apiKey.create({
      data: {
        projectId: project.id,
        name: 'Pact',
        prefix: PACT_API_KEY.slice(0, 12),
        keyHash: createHash('sha256').update(PACT_API_KEY).digest('hex'),
      },
    });
    return { projectId: project.id };
  }

  async function createSuite(projectId: string): Promise<void> {
    const target = await prisma.target.create({ data: { projectId, name: 'ShopBot', type: 'SHOPBOT' } });
    await prisma.testSuite.create({
      data: {
        id: PACT_SUITE_ID,
        projectId,
        targetId: target.id,
        name: 'ShopBot core support',
        cases: {
          create: [
            {
              name: 'Refund window is 30 days',
              input: 'Can I return it?',
              checksJson: [{ type: 'contains', value: '30 days' }],
              tags: [],
              position: 0,
            },
          ],
        },
      },
    });
  }

  it('verifies every pact in contracts/pacts', async () => {
    const pactUrls = readdirSync(PACT_DIR)
      .filter((file) => file.endsWith('.json'))
      .map((file) => resolve(PACT_DIR, file));
    if (pactUrls.length === 0)
      throw new Error('No pacts found. Run the consumer tests first (npm run test:consumer).');

    await new Verifier({
      provider: PROVIDER,
      providerBaseUrl: baseUrl,
      pactUrls,
      logLevel: 'warn',
      stateHandlers: {
        'a project with an API key': async () => {
          await resetPactData();
        },
        'no API key matches': async () => {
          await prisma.user.deleteMany({ where: { email: 'pact@test.evalpilot.dev' } });
        },
        'a suite with a target and test cases': async () => {
          const { projectId } = await resetPactData();
          await createSuite(projectId);
        },
        'a finished run with results': async () => {
          const { projectId } = await resetPactData();
          await createSuite(projectId);
          const testCase = await prisma.testCase.findFirstOrThrow({ where: { suiteId: PACT_SUITE_ID } });
          await prisma.testRun.create({
            data: {
              id: PACT_RUN_ID,
              suiteId: PACT_SUITE_ID,
              status: 'FAILED',
              trigger: 'CLI',
              commitSha: 'abc1234',
              total: 2,
              passed: 1,
              failed: 1,
              passRate: 0.5,
              startedAt: new Date(),
              finishedAt: new Date(),
              results: {
                create: [
                  {
                    testCaseId: testCase.id,
                    caseName: testCase.name,
                    position: 0,
                    status: 'PASSED',
                    output: 'Within 30 days.',
                    latencyMs: 412,
                    checkResultsJson: [{ type: 'contains', passed: true, message: 'Contains "30 days"' }],
                  },
                  {
                    caseName: 'Deleted case',
                    position: 1,
                    status: 'FAILED',
                    output: 'Hmm.',
                    latencyMs: 380,
                    checkResultsJson: [{ type: 'contains', passed: false, message: 'Missing "refund"' }],
                  },
                ],
              },
            },
          });
        },
      },
    }).verifyProvider();
  });
});

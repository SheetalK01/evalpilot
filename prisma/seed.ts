/**
 * Seeds the attack library and a demo workspace (user, project, ShopBot target, suite).
 * Safe to run repeatedly: attacks are upserted by name and the demo workspace is only
 * created when the demo user does not exist yet, so your own changes are never wiped.
 *
 *   npm run db:seed
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  apiKeyDisplayPrefix,
  ATTACK_LIBRARY,
  checksSchema,
  isApiKeyFormat,
  SHOPBOT_DEMO_CASES,
} from '@evalpilot/shared';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_USER = {
  name: 'Demo Pilot',
  email: 'demo@evalpilot.dev',
  password: 'evalpilot-demo-2026',
} as const;

async function seedAttacks(): Promise<number> {
  for (const attack of ATTACK_LIBRARY) {
    const data = {
      category: attack.category,
      prompt: attack.prompt,
      severity: attack.severity,
      detectionJson: attack.detection as Prisma.InputJsonValue,
    };
    await prisma.attack.upsert({
      where: { name: attack.name },
      update: data,
      create: { name: attack.name, ...data },
    });
  }
  return ATTACK_LIBRARY.length;
}

async function seedDemoWorkspace(): Promise<'created' | 'exists'> {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_USER.email } });
  if (existing) return 'exists';

  // Validate the demo checks with the same schema the API uses.
  const cases = SHOPBOT_DEMO_CASES.map((demoCase) => ({
    ...demoCase,
    checks: checksSchema.parse(demoCase.checks),
  }));

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: DEMO_USER.name,
        email: DEMO_USER.email,
        passwordHash: await bcrypt.hash(DEMO_USER.password, 12),
      },
    });
    const project = await tx.project.create({
      data: {
        ownerId: user.id,
        name: 'ShopSphere Support',
        description:
          'Customer-support assistant for the ShopSphere store: refunds, shipping and order status.',
      },
    });
    // ShopBot's URL comes from SHOPBOT_URL at run time, so the same row works with and without Docker.
    const target = await tx.target.create({
      data: { projectId: project.id, name: 'ShopBot (demo)', type: 'SHOPBOT', timeoutMs: 15000 },
    });
    await tx.testSuite.create({
      data: {
        projectId: project.id,
        targetId: target.id,
        name: 'ShopBot core support',
        description: 'Refund policy, shipping, order status, privacy and tone checks for ShopBot.',
        passThreshold: 0.85,
        cases: {
          create: cases.map((demoCase, position) => ({
            name: demoCase.name,
            input: demoCase.input,
            checksJson: demoCase.checks as Prisma.InputJsonValue,
            tags: demoCase.tags,
            position,
          })),
        },
      },
    });
  });
  return 'created';
}

/**
 * If EVALPILOT_API_KEY is set (scripts/dev-local.sh generates one), register it on the demo
 * project so ShopBot can send traces without any manual setup. Only the hash is stored.
 */
async function seedDemoApiKey(): Promise<'registered' | 'exists' | 'skipped'> {
  const rawKey = process.env.EVALPILOT_API_KEY?.trim();
  if (!rawKey || !isApiKeyFormat(rawKey)) return 'skipped';
  const keyHash = createHash('sha256').update(rawKey, 'utf8').digest('hex');
  if (await prisma.apiKey.findUnique({ where: { keyHash } })) return 'exists';
  const project = await prisma.project.findFirst({
    where: { owner: { email: DEMO_USER.email } },
    orderBy: { createdAt: 'asc' },
  });
  if (!project) return 'skipped';
  await prisma.apiKey.create({
    data: { projectId: project.id, name: 'ShopBot (local)', prefix: apiKeyDisplayPrefix(rawKey), keyHash },
  });
  return 'registered';
}

async function main(): Promise<void> {
  const attacks = await seedAttacks();
  console.log(`✓ Attack library: ${attacks} attacks upserted`);
  const workspace = await seedDemoWorkspace();
  console.log(
    workspace === 'created'
      ? `✓ Demo workspace created. Log in as ${DEMO_USER.email} / ${DEMO_USER.password}`
      : `• Demo workspace already exists (${DEMO_USER.email}); left unchanged`,
  );
  const apiKey = await seedDemoApiKey();
  if (apiKey === 'registered')
    console.log('✓ EVALPILOT_API_KEY registered on the demo project (ShopBot traces will appear)');
  if (apiKey === 'exists') console.log('• EVALPILOT_API_KEY already registered');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

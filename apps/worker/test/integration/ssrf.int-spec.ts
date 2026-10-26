import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_CONFIG, type AppConfig, loadConfig, PrismaService } from '@evalpilot/server-core';
import { RunExecutor } from '../../src/runs/run-executor';
import { ExecutorsModule } from '../../src/worker.module';
import { type FakeTarget, startFakeTarget } from '../utils/fake-target';
import { createRunFixture } from '../utils/fixtures';

/** Production-like config: private targets are NOT allowed. */
describe('SSRF protection in a real run', () => {
  let ctx: INestApplicationContext;
  let prisma: PrismaService;
  let internal: FakeTarget;

  beforeAll(async () => {
    const config: AppConfig = { ...loadConfig(), allowPrivateTargets: false };
    const moduleRef = await Test.createTestingModule({ imports: [ExecutorsModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .compile();
    ctx = await moduleRef.init();
    prisma = ctx.get(PrismaService);
    internal = await startFakeTarget(() => ({ body: { reply: 'internal admin data' } }));
  });

  afterAll(async () => {
    await internal.close();
    await ctx.close();
  });

  it.each([
    ['loopback', (url: string) => `${url}/chat`],
    ['localhost name', (url: string) => `${url.replace('127.0.0.1', 'localhost')}/chat`],
    ['cloud metadata', () => 'http://169.254.169.254/latest/meta-data/'],
    ['IPv6 loopback', (url: string) => `${url.replace('127.0.0.1', '[::1]')}/chat`],
  ])('blocks a target on %s and never sends the request', async (_label, makeUrl) => {
    const fixture = await createRunFixture(prisma, {
      targetUrl: internal.url,
      cases: [{ name: 'Probe', input: 'hi', checks: [{ type: 'contains', value: 'admin' }] }],
    });
    await prisma.target.update({ where: { id: fixture.target.id }, data: { url: makeUrl(internal.url) } });
    const before = internal.requests.length;

    await ctx.get(RunExecutor).execute(fixture.run.id);

    const [result] = await prisma.testResult.findMany({ where: { runId: fixture.run.id } });
    expect(result).toMatchObject({ status: 'ERROR', output: null });
    expect(result?.error).toMatch(/^Blocked:/);
    expect(internal.requests.length).toBe(before);
  });
});

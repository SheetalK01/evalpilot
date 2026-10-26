import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { APP_CONFIG, type AppConfig, PrismaService } from '@evalpilot/server-core';

export interface TestApp {
  app: INestApplication;
  /** Base URL when started with `listen: true`, otherwise ''. */
  url: string;
  server: Server;
  prisma: PrismaService;
  config: AppConfig;
  close: () => Promise<void>;
}

/**
 * Boots the real AppModule with the production pipeline (guards, filters, parsers) on the test DB.
 * `listen: true` also opens a port (needed by WebSocket clients); `url` is then set.
 */
export async function createTestApp(options: { listen?: boolean } = {}): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, config);
  await app.init();
  let url = '';
  if (options.listen) {
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  }
  return {
    url,
    app,
    server: app.getHttpServer() as Server,
    prisma: app.get(PrismaService),
    config,
    close: () => app.close(),
  };
}

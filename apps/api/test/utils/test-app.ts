import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { APP_CONFIG, type AppConfig } from '../../src/config/env';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface TestApp {
  app: INestApplication;
  server: Server;
  prisma: PrismaService;
  config: AppConfig;
  close: () => Promise<void>;
}

/** Boots the real AppModule with the production pipeline (guards, filters, parsers) on the test DB. */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, config);
  await app.init();
  return {
    app,
    server: app.getHttpServer() as Server,
    prisma: app.get(PrismaService),
    config,
    close: () => app.close(),
  };
}

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadRootEnv } from '@evalpilot/server-core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  loadRootEnv();
  // No HTTP server: the worker only consumes queues.
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
}

void bootstrap();

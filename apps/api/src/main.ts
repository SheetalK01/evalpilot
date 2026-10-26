import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { APP_CONFIG, type AppConfig } from './config/env';
import { loadRootEnv } from './config/load-env';

async function bootstrap(): Promise<void> {
  // Config is read when Nest builds the providers, so loading .env here (before create) is enough.
  loadRootEnv();
  const app = await NestFactory.create(AppModule, { bodyParser: false, bufferLogs: true });
  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, config);
  await app.listen(config.port);
}

void bootstrap();

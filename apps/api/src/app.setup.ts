import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SESSION_COOKIE } from '@evalpilot/shared';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import type { AppConfig } from './config/env';

export const DOCS_PATH = 'api/docs';

const apiHelmet = helmet();
// Swagger UI needs inline scripts and styles; everything else gets the strict default CSP.
const docsHelmet = helmet({ contentSecurityPolicy: false });

function setupSwagger(app: INestApplication, config: AppConfig): void {
  const document = new DocumentBuilder()
    .setTitle('EvalPilot API')
    .setDescription(
      'Test, red-team and monitor AI apps. Browser clients authenticate with the session cookie; ' +
        'the SDK and CLI use a project API key (`Authorization: Bearer ep_live_…`).',
    )
    .setVersion('1.0')
    .addServer(config.apiUrl)
    .addCookieAuth(SESSION_COOKIE, { type: 'apiKey', in: 'cookie', name: SESSION_COOKIE }, 'session')
    .addBearerAuth({ type: 'http', scheme: 'bearer', description: 'Project API key (ep_live_…)' }, 'apiKey')
    .build();
  SwaggerModule.setup(DOCS_PATH, app, cleanupOpenApiDoc(SwaggerModule.createDocument(app, document)), {
    jsonDocumentUrl: `${DOCS_PATH}-json`,
    customSiteTitle: 'EvalPilot API',
  });
}

/** Shared by `main.ts` and the integration tests, so tests run the exact production pipeline. */
export function configureApp(app: INestApplication, config: AppConfig): INestApplication {
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const policy = req.path.startsWith(`/${DOCS_PATH}`) ? docsHelmet : apiHelmet;
    policy(req, res, next);
  });
  app.use(cookieParser());
  // Request size limits: JSON bodies up to 1 MB, CSV imports up to 2 MB.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.text({ type: 'text/csv', limit: '2mb' }));
  app.enableCors({
    origin: config.allowedOrigins,
    credentials: true,
    exposedHeaders: ['x-request-id', 'content-disposition'],
  });
  app.enableShutdownHooks();
  setupSwagger(app, config);
  return app;
}

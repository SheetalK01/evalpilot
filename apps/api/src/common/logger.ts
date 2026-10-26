import type { Params } from 'nestjs-pino';
import type { AppConfig } from '../config/env';
import { resolveRequestId } from './request-id';

/** Structured JSON logs with the request id on every line. Secrets are redacted. */
export function pinoOptions(config: AppConfig): Params {
  return {
    pinoHttp: {
      level: config.logLevel,
      genReqId: resolveRequestId,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body.password',
        ],
        censor: '[redacted]',
      },
      customProps: () => ({ service: 'api' }),
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      ...(config.env === 'development'
        ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
        : {}),
    },
  };
}

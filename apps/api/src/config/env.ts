import { AI_MODES, type AiMode } from '@evalpilot/shared';
import { z } from 'zod';

/** Treats empty strings (e.g. `GITHUB_CLIENT_ID=` in .env) as "not set". */
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_URL: z.url().default('http://localhost:4000'),
  WEB_URL: z.url().default('http://localhost:3000'),
  /** Extra comma-separated origins allowed by CORS and the CSRF origin check. */
  CORS_ORIGINS: optionalString,
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60),
  TARGET_SECRET_KEY: z
    .string()
    .refine(
      (value) => Buffer.from(value, 'base64').length === 32,
      'TARGET_SECRET_KEY must be 32 bytes, base64-encoded',
    ),
  AI_MODE: z.enum(AI_MODES).default('mock'),
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  ALLOW_PRIVATE_TARGETS: booleanString.default(false),
  SHOPBOT_URL: z.url().default('http://localhost:4100'),
  RATE_LIMIT_DEFAULT: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_AUTH: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_V1: z.coerce.number().int().positive().default(1200),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  apiUrl: string;
  webUrl: string;
  /** Origins allowed for CORS and cookie-authenticated mutations. */
  allowedOrigins: string[];
  databaseUrl: string;
  redisUrl: string;
  jwt: { secret: string; ttlSeconds: number };
  targetSecretKey: Buffer;
  aiMode: AiMode;
  allowPrivateTargets: boolean;
  shopbotUrl: string;
  github: { clientId: string; clientSecret: string; callbackUrl: string } | null;
  rateLimits: { default: number; auth: number; v1: number };
  logLevel: z.infer<typeof envSchema>['LOG_LEVEL'];
}

export const APP_CONFIG = Symbol('APP_CONFIG');

const originOf = (url: string) => new URL(url).origin;

/** Parses and validates environment variables. Throws a readable error listing every problem. */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  const env = parsed.data;
  const extraOrigins = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(originOf);
  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.API_PORT,
    apiUrl: env.API_URL,
    webUrl: env.WEB_URL,
    allowedOrigins: [...new Set([originOf(env.WEB_URL), originOf(env.API_URL), ...extraOrigins])],
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    jwt: { secret: env.JWT_SECRET, ttlSeconds: env.JWT_TTL_SECONDS },
    targetSecretKey: Buffer.from(env.TARGET_SECRET_KEY, 'base64'),
    aiMode: env.AI_MODE,
    allowPrivateTargets: env.ALLOW_PRIVATE_TARGETS,
    shopbotUrl: env.SHOPBOT_URL,
    github:
      env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
            callbackUrl: `${env.API_URL}/api/auth/github/callback`,
          }
        : null,
    rateLimits: { default: env.RATE_LIMIT_DEFAULT, auth: env.RATE_LIMIT_AUTH, v1: env.RATE_LIMIT_V1 },
    logLevel: env.LOG_LEVEL,
  };
}

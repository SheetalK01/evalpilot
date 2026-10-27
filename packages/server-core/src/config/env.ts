import { AI_MODES, type AiMode } from '@evalpilot/shared';
import { z } from 'zod';

/** Treats empty strings (e.g. `GITHUB_CLIENT_ID=` in .env) as "not set". */
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    API_URL: z.url().default('http://localhost:4000'),
    WEB_URL: z.url().default('http://localhost:3000'),
    /** Extra comma-separated origins allowed by CORS and the CSRF origin check. */
    CORS_ORIGINS: optionalString,
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
    /** Namespace for every Redis key, queue and channel (tests use a unique one per file). */
    REDIS_PREFIX: z
      .string()
      .regex(/^[\w-]{1,60}$/)
      .default('evalpilot'),
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
    ANTHROPIC_API_KEY: optionalString,
    ANTHROPIC_MODEL: z.string().trim().min(1).default('claude-opus-5-5'),
    /** Reasoning effort for judge calls; graders do well at low/medium. */
    JUDGE_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),
    GITHUB_CLIENT_ID: optionalString,
    GITHUB_CLIENT_SECRET: optionalString,
    ALLOW_PRIVATE_TARGETS: booleanString.default(false),
    /** `Secure` session cookie. Defaults to on in production; turn off only for plain-http local Docker. */
    COOKIE_SECURE: booleanString.optional(),
    SHOPBOT_URL: z.url().default('http://localhost:4100'),
    /** How many runs one worker processes at the same time (each run tests 4 cases at a time). */
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(4),
    RATE_LIMIT_DEFAULT: z.coerce.number().int().positive().default(300),
    RATE_LIMIT_AUTH: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_V1: z.coerce.number().int().positive().default(1200),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  })
  .refine((env) => env.AI_MODE === 'mock' || env.ANTHROPIC_API_KEY, {
    message: 'AI_MODE=live needs ANTHROPIC_API_KEY (or use AI_MODE=mock)',
    path: ['ANTHROPIC_API_KEY'],
  });

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  isProduction: boolean;
  /** Send the session cookie with `Secure`. */
  cookieSecure: boolean;
  port: number;
  apiUrl: string;
  webUrl: string;
  /** Origins allowed for CORS and cookie-authenticated mutations. */
  allowedOrigins: string[];
  databaseUrl: string;
  redisUrl: string;
  redisPrefix: string;
  jwt: { secret: string; ttlSeconds: number };
  targetSecretKey: Buffer;
  aiMode: AiMode;
  anthropic: { apiKey: string | null; model: string; judgeEffort: 'low' | 'medium' | 'high' };
  allowPrivateTargets: boolean;
  shopbotUrl: string;
  github: { clientId: string; clientSecret: string; callbackUrl: string } | null;
  rateLimits: { default: number; auth: number; v1: number };
  workerConcurrency: number;
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
    cookieSecure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    port: env.API_PORT,
    apiUrl: env.API_URL,
    webUrl: env.WEB_URL,
    allowedOrigins: [...new Set([originOf(env.WEB_URL), originOf(env.API_URL), ...extraOrigins])],
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    redisPrefix: env.REDIS_PREFIX,
    jwt: { secret: env.JWT_SECRET, ttlSeconds: env.JWT_TTL_SECONDS },
    targetSecretKey: Buffer.from(env.TARGET_SECRET_KEY, 'base64'),
    aiMode: env.AI_MODE,
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY ?? null,
      model: env.ANTHROPIC_MODEL,
      judgeEffort: env.JUDGE_EFFORT,
    },
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
    workerConcurrency: env.WORKER_CONCURRENCY,
    logLevel: env.LOG_LEVEL,
  };
}

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Repo root, whatever directory Playwright was started from. */
export const ROOT = resolve(import.meta.dirname, '../..');

/** Values from the git-ignored `.env`, without overriding real environment variables. */
function readDotEnv(): Record<string, string> {
  let text = '';
  try {
    text = readFileSync(resolve(ROOT, '.env'), 'utf8');
  } catch {
    return {};
  }
  const values: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match?.[1]) continue;
    values[match[1]] = (match[2] ?? '').replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

const fileEnv = readDotEnv();
const read = (name: string): string | undefined => process.env[name] ?? fileEnv[name];

/** Ports of the E2E stack, chosen so it can run next to `scripts/dev-local.sh`. */
export const PORTS = { web: 3300, api: 4400, shopbot: 4500 } as const;

export const WEB_URL = `http://localhost:${PORTS.web}`;
export const API_URL = `http://localhost:${PORTS.api}`;
export const SHOPBOT_URL = `http://localhost:${PORTS.shopbot}`;

/**
 * Environment for the API, worker and ShopBot of the E2E stack: the TEST database, its own Redis
 * namespace, mock AI and the real SSRF guard (ShopBot is a built-in target, so it still works).
 */
export function stackEnv(): Record<string, string> {
  const testDb = read('TEST_DATABASE_URL');
  if (!testDb) throw new Error('TEST_DATABASE_URL is not set (add it to .env)');
  if (!/_test(\?|$)/.test(testDb))
    throw new Error('TEST_DATABASE_URL must point at a database whose name ends with _test');
  const required = (name: string) => {
    const value = read(name);
    if (!value) throw new Error(`${name} is not set (run scripts/dev-local.sh once, or add it to .env)`);
    return value;
  };
  return {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    NODE_ENV: 'test',
    DATABASE_URL: testDb,
    TEST_DATABASE_URL: testDb,
    REDIS_URL: read('REDIS_URL') ?? 'redis://127.0.0.1:6379',
    REDIS_PREFIX: 'evalpilot-e2e',
    JWT_SECRET: required('JWT_SECRET'),
    TARGET_SECRET_KEY: required('TARGET_SECRET_KEY'),
    API_PORT: String(PORTS.api),
    API_URL,
    WEB_URL,
    SHOPBOT_PORT: String(PORTS.shopbot),
    SHOPBOT_URL,
    EVALPILOT_URL: API_URL,
    AI_MODE: 'mock',
    ALLOW_PRIVATE_TARGETS: 'false',
    // Many parallel workers share one IP; the auth bucket stays at its real value so it can be tested.
    RATE_LIMIT_DEFAULT: '100000',
    RATE_LIMIT_V1: '100000',
    RATE_LIMIT_AUTH: '10',
    LOG_LEVEL: 'warn',
  };
}

export const AUTH_RATE_LIMIT = 10;

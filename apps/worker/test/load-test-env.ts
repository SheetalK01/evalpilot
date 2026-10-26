import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

export const REPO_ROOT = resolve(__dirname, '../../..');

/** Same rules as the API tests: the TEST database, mock AI, and a unique Redis namespace per file. */
export function loadTestEnv(): void {
  const envFile = resolve(REPO_ROOT, '.env');
  if (existsSync(envFile)) config({ path: envFile, quiet: true });
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error('TEST_DATABASE_URL is not set. Add it to .env (see .env.example).');
  if (!new URL(testUrl).pathname.endsWith('_test'))
    throw new Error('TEST_DATABASE_URL must point to a database ending in _test');
  Object.assign(process.env, {
    DATABASE_URL: testUrl,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    AI_MODE: 'mock',
    ANTHROPIC_API_KEY: '',
    REDIS_PREFIX: `evalpilot-test-${randomBytes(4).toString('hex')}`,
    // The fake targets in these tests listen on 127.0.0.1.
    ALLOW_PRIVATE_TARGETS: 'true',
  });
}

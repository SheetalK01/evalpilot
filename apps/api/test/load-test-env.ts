import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

export const REPO_ROOT = resolve(__dirname, '../../..');

/**
 * Loads `.env` (local runs; CI passes real env vars) and points the app at the TEST database.
 * Integration tests never touch the main `evalpilot` database.
 */
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
    RATE_LIMIT_DEFAULT: '100000',
    RATE_LIMIT_AUTH: '5',
    GITHUB_CLIENT_ID: '',
    GITHUB_CLIENT_SECRET: '',
  });
}

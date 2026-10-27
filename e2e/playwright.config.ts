import { defineConfig, devices } from '@playwright/test';
import { API_URL, PORTS, ROOT, SHOPBOT_URL, WEB_URL, stackEnv } from './support/env';

const env = stackEnv();
const CI = Boolean(process.env.CI);

/**
 * One stack for every project: API, worker and ShopBot from their compiled `dist`, the web app
 * from `next start` (built with `npm run build:web:e2e`). `npm run test:e2e` builds everything.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 4 : 6,
  timeout: 45_000,
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  reporter: [
    ['list'],
    ['html', { outputFolder: './reports/html', open: 'never' }],
    ['junit', { outputFile: './reports/junit.xml' }],
  ],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    testIdAttribute: 'data-testid',
  },
  snapshotPathTemplate: '{testDir}/{testFileDir}/__snapshots__/{platform}/{arg}{ext}',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /(api|visual)\// },
    { name: 'api', testMatch: /api\/.*\.spec\.ts/, use: { baseURL: API_URL } },
    {
      name: 'visual',
      testMatch: /visual\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  globalSetup: './support/global-setup.ts',
  webServer: [
    {
      name: 'api',
      command: 'bash scripts/reset-test-db.sh && npx prisma db seed >/dev/null && node apps/api/dist/main.js',
      cwd: ROOT,
      env,
      url: `${API_URL}/api/health`,
      reuseExistingServer: !CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      name: 'worker',
      command: 'node apps/worker/dist/main.js',
      cwd: ROOT,
      env,
      // No HTTP port: global setup waits until its heartbeat shows up in /api/health.
      reuseExistingServer: !CI,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      name: 'shopbot',
      command: 'node apps/shopbot/dist/main.js',
      cwd: ROOT,
      env,
      url: `${SHOPBOT_URL}/health`,
      reuseExistingServer: !CI,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      name: 'web',
      command: `npx next start --port ${PORTS.web}`,
      cwd: `${ROOT}/apps/web`,
      env: { ...env, NEXT_DIST_DIR: '.next-e2e', PORT: String(PORTS.web) },
      url: WEB_URL,
      reuseExistingServer: !CI,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});

/**
 * Records the README demo: sign in → dashboard → suite → live run → red-team report.
 *
 *   npx tsx scripts/record-demo.ts [--base http://localhost:3000]   (stack running, demo seeded)
 *
 * Writes docs/demo.gif (needs ffmpeg).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const index = process.argv.indexOf('--base');
const BASE = index >= 0 ? (process.argv[index + 1] ?? 'http://localhost:3000') : 'http://localhost:3000';
const size = { width: 1280, height: 760 };

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'evalpilot-demo-'));
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: size, recordVideo: { dir, size } });
  await context.addInitScript(() => localStorage.setItem('evalpilot-theme', 'dark'));
  const page = await context.newPage();
  const pause = (ms: number) => page.waitForTimeout(ms);

  await page.goto(`${BASE}/login`);
  await page.getByTestId('login-email').pressSequentially('demo@evalpilot.dev', { delay: 25 });
  await page.getByTestId('login-password').pressSequentially('evalpilot-demo-2026', { delay: 25 });
  await page.getByTestId('login-submit').click();
  await page.getByTestId('risk-gauge').waitFor();
  await pause(2500);

  await page.getByTestId('project-card').first().click();
  await page.getByTestId('suite-link').first().click();
  await page.getByTestId('case-row').first().waitFor();
  await pause(1500);
  await page.getByTestId('run-button').click();
  await page.getByTestId('run-page').waitFor();
  await page
    .getByTestId('run-status')
    .getByText(/PASS|FAIL/)
    .waitFor({ timeout: 30_000 });
  await pause(2500);
  await page.getByTestId('result-row').first().getByRole('button').first().click();
  await pause(2000);

  await page.goBack();
  await page.goBack();
  await page.getByTestId('tab-redteam').click();
  await page.getByTestId('redteam-row').first().click();
  await page.getByTestId('risk-score').waitFor();
  await pause(3000);

  await context.close();
  await browser.close();
  const video = readdirSync(dir).find((file) => file.endsWith('.webm'));
  if (!video) throw new Error('no video recorded');
  const out = resolve('docs/demo.gif');
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    join(dir, video),
    '-vf',
    'fps=10,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=5',
    out,
  ]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`✓ ${out}`);
}

void main();

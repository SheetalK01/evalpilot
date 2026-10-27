import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures/workspace';

/**
 * Screenshot comparisons of the key screens in both themes. Anything that changes from run to
 * run (clocks, relative times, ids, generated names) is masked. Baselines are per platform; CI
 * creates missing ones on first run (`--update-snapshots=missing`).
 */
const THEMES = ['dark', 'light'] as const;

async function prepare(page: Page, theme: (typeof THEMES)[number]) {
  await page.addInitScript((value) => localStorage.setItem('evalpilot-theme', value), theme);
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

/** Things that legitimately differ between runs. */
const dynamic = (page: Page) => [
  page.getByTestId('health-leds'),
  page.locator('time'),
  page.locator('[data-dynamic]'),
  page.locator('.recharts-wrapper'),
];

for (const theme of THEMES) {
  test.describe(`Visual · ${theme} @visual`, () => {
    test('landing', async ({ page }) => {
      await prepare(page, theme);
      await page.goto('/');
      await page.getByTestId('hero-start').waitFor();
      await expect(page).toHaveScreenshot(`landing-${theme}.png`, { mask: dynamic(page) });
    });

    test('design system', async ({ page, signedInWorkspace: _ws }) => {
      await prepare(page, theme);
      await page.goto('/app/design');
      await page.getByTestId('design-page').waitFor();
      await expect(page).toHaveScreenshot(`design-${theme}.png`, { mask: dynamic(page), fullPage: true });
    });

    test('dashboard', async ({ page, signedInWorkspace: _ws }) => {
      await prepare(page, theme);
      await page.goto('/app');
      await page.getByTestId('risk-gauge').waitFor();
      await expect(page).toHaveScreenshot(`dashboard-${theme}.png`, { mask: dynamic(page) });
    });

    test('run view', async ({ page, signedInWorkspace: ws }) => {
      await prepare(page, theme);
      await page.goto(`/app/runs/${ws.runId}`);
      await expect(page.getByTestId('result-row')).toHaveCount(5);
      await expect(page).toHaveScreenshot(`run-${theme}.png`, { mask: dynamic(page) });
    });

    test('red-team report', async ({ page, signedInWorkspace: ws }) => {
      await prepare(page, theme);
      await page.goto(`/app/redteam/${ws.redteamId}`);
      await expect(page.getByTestId('finding-row')).toHaveCount(26);
      await expect(page).toHaveScreenshot(`redteam-${theme}.png`, { mask: dynamic(page) });
    });
  });
}

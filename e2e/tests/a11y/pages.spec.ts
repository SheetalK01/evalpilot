import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../../fixtures/workspace';
import { PAGES } from '../../support/pages';

const THEMES = ['dark', 'light'] as const;

/**
 * axe on every page in both themes. The build fails on any serious or critical violation;
 * minor/moderate ones are attached to the report for review.
 */
for (const theme of THEMES) {
  test.describe(`Accessibility · ${theme} theme @a11y`, () => {
    for (const target of PAGES) {
      test(`${target.name} has no serious or critical violations`, async ({
        page,
        context,
        workspace,
      }, testInfo) => {
        if (target.auth) await context.addCookies((await workspace.session.api.ctx.storageState()).cookies);
        await page.addInitScript((value) => localStorage.setItem('evalpilot-theme', value), theme);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(target.path(workspace));
        await page.getByTestId(target.ready).first().waitFor();

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        await testInfo.attach('axe-results.json', {
          body: JSON.stringify(results.violations, null, 2),
          contentType: 'application/json',
        });
        const blocking = results.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.map((n) => `${n.target.join(' ')} — ${n.failureSummary ?? ''}`),
          }));
        expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
      });
    }
  });
}

test.describe('Keyboard @a11y', () => {
  test('the skip link moves focus to the main content', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: /skip to/i });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeInViewport();
  });

  test('the login form works with the keyboard alone', async ({ page, workspace }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').focus();
    await page.keyboard.type(workspace.session.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(workspace.session.password);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/app$/);
  });
});

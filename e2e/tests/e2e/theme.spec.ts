import { expect, test } from '../../fixtures/test';

test.describe('Theme', () => {
  test('the toggle switches themes and the choice survives a reload @regression', async ({
    page,
    signedIn: _signedIn,
    dashboard,
  }) => {
    await dashboard.useTheme('dark');
    await dashboard.goto();
    expect(await dashboard.theme()).toBe('dark');
    await dashboard.themeToggle.click();
    expect(await dashboard.theme()).toBe('light');
    await page.reload();
    expect(await dashboard.theme()).toBe('light');
  });

  test('the command palette opens with the keyboard and navigates @regression', async ({
    page,
    signedIn: _signedIn,
    dashboard,
  }) => {
    await dashboard.goto();
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByTestId('command-palette');
    await expect(palette).toBeVisible();
    await page.keyboard.type('settings');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/app\/settings$/);
  });
});

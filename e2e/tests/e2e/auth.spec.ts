import { expect, test } from '../../fixtures/test';
import { PASSWORD, uniqueEmail } from '../../support/api';

test.describe('Authentication', () => {
  test('a visitor registers, lands on an empty dashboard, signs out and back in @smoke', async ({
    page,
    registerPage,
    loginPage,
    dashboard,
  }) => {
    const email = uniqueEmail('register');
    await registerPage.goto();
    await registerPage.register('Ada Tester', email, PASSWORD);

    await expect(page).toHaveURL(/\/app$/);
    await expect(dashboard.root).toContainText('No projects yet');

    await dashboard.logout();
    await expect(page).toHaveURL(/\/(login)?$/);

    await loginPage.goto();
    await loginPage.login(email, PASSWORD);
    await expect(dashboard.root).toBeVisible();
  });

  test('shows a clear error for a wrong password @regression', async ({ session, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(session.email, 'wrong-passw0rd');
    await expect(loginPage.error).toContainText(/invalid|incorrect/i);
  });

  test('validates the registration form before sending it @regression', async ({ registerPage, page }) => {
    await registerPage.goto();
    await registerPage.register('Ada', 'not-an-email', 'short');
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByText(/valid email/i)).toBeVisible();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test('sends signed-out visitors to the login page and back after signing in @smoke', async ({
    page,
    session,
    loginPage,
  }) => {
    await page.goto('/app/settings');
    await expect(page).toHaveURL(/\/login\?next=/);
    await loginPage.login(session.email, session.password);
    await expect(page).toHaveURL(/\/app\/settings$/);
  });

  test('refuses to register the same email twice @regression', async ({ session, registerPage }) => {
    await registerPage.goto();
    await registerPage.register('Copy Cat', session.email, PASSWORD);
    await expect(registerPage.error).toContainText(/already/i);
  });
});

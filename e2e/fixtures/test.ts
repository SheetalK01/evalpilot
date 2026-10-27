import { test as base, expect } from '@playwright/test';
import { registerUser, type Session } from '../support/api';
import { DashboardPage } from '../pages/dashboard.page';
import { LoginPage, RegisterPage } from '../pages/auth.page';
import { ProjectPage } from '../pages/project.page';
import { RedteamPage } from '../pages/redteam.page';
import { RunPage } from '../pages/run.page';
import { SettingsPage } from '../pages/settings.page';
import { SuitePage } from '../pages/suite.page';
import { TracesPage } from '../pages/traces.page';

interface Fixtures {
  /** A brand-new user (registered through the API) with a cookie-authenticated client. */
  session: Session;
  /** The same user, signed in inside the browser page. */
  signedIn: Session;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  dashboard: DashboardPage;
  projectPage: ProjectPage;
  suitePage: SuitePage;
  runPage: RunPage;
  redteamPage: RedteamPage;
  tracesPage: TracesPage;
  settingsPage: SettingsPage;
}

export const test = base.extend<Fixtures>({
  session: async ({}, use, testInfo) => {
    const session = await registerUser(`w${testInfo.workerIndex}`);
    await use(session);
    await session.api.ctx.dispose();
  },
  signedIn: async ({ session, context }, use) => {
    const { cookies } = await session.api.ctx.storageState();
    await context.addCookies(cookies);
    await use(session);
  },
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  dashboard: async ({ page }, use) => use(new DashboardPage(page)),
  projectPage: async ({ page }, use) => use(new ProjectPage(page)),
  suitePage: async ({ page }, use) => use(new SuitePage(page)),
  runPage: async ({ page }, use) => use(new RunPage(page)),
  redteamPage: async ({ page }, use) => use(new RedteamPage(page)),
  tracesPage: async ({ page }, use) => use(new TracesPage(page)),
  settingsPage: async ({ page }, use) => use(new SettingsPage(page)),
});

export { expect };

import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class DashboardPage extends BasePage {
  readonly root: Locator = this.page.getByTestId('dashboard');
  readonly newProject: Locator = this.page.getByTestId('new-project-button');
  readonly projectCards: Locator = this.page.getByTestId('project-card');
  readonly userMenu: Locator = this.page.getByTestId('user-menu');

  async goto(): Promise<void> {
    await this.page.goto('/app');
    await this.root.waitFor();
  }

  /** Creates a project through the dialog and waits for its page. */
  async createProject(name: string): Promise<void> {
    await this.newProject.click();
    await this.page.getByTestId('project-name').fill(name);
    await this.page.getByTestId('project-create-submit').click();
    await this.page.getByTestId('project-page').waitFor();
  }

  async logout(): Promise<void> {
    await this.userMenu.click();
    await this.page.getByTestId('logout').click();
  }
}

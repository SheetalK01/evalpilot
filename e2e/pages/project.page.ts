import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export type ProjectTab = 'suites' | 'targets' | 'redteam' | 'traces' | 'settings';

export class ProjectPage extends BasePage {
  readonly root: Locator = this.page.getByTestId('project-page');
  readonly targetRows: Locator = this.page.getByTestId('target-row');
  readonly suiteRows: Locator = this.page.getByTestId('suite-row');
  readonly redteamRows: Locator = this.page.getByTestId('redteam-row');

  async goto(projectId: string, tab?: ProjectTab): Promise<void> {
    await this.page.goto(`/app/projects/${projectId}${tab ? `?tab=${tab}` : ''}`);
    await this.root.waitFor();
  }

  async openTab(tab: ProjectTab): Promise<void> {
    await this.page.getByTestId(`tab-${tab}`).click();
  }

  async addShopbotTarget(name = 'ShopBot'): Promise<void> {
    await this.openTab('targets');
    await this.page.getByTestId('target-add').click();
    await this.page.getByTestId('target-type-shopbot').click();
    await this.page.getByTestId('target-name').fill(name);
    await this.page.getByTestId('target-save').click();
    await this.targetRows.filter({ hasText: name }).waitFor();
  }

  async addHttpTarget(name: string, url: string): Promise<void> {
    await this.openTab('targets');
    await this.page.getByTestId('target-add').click();
    await this.page.getByTestId('target-type-http').click();
    await this.page.getByTestId('target-name').fill(name);
    await this.page.getByTestId('target-url').fill(url);
    await this.page.getByTestId('target-save').click();
  }

  async ping(targetName: string): Promise<Locator> {
    const row = this.targetRows.filter({ hasText: targetName });
    await row.getByTestId('target-ping').click();
    return row.getByTestId('ping-result');
  }

  /** Creates a suite through the dialog; lands on the suite editor. */
  async createSuite(name: string, targetName: string): Promise<void> {
    await this.openTab('suites');
    await this.page.getByTestId('new-suite-button').click();
    await this.page.getByTestId('suite-name').fill(name);
    await this.page.getByTestId('suite-target').selectOption({ label: targetName });
    await this.page.getByTestId('suite-create-submit').click();
    await this.page.getByTestId('suite-page').waitFor();
  }

  async startRedteam(): Promise<void> {
    await this.openTab('redteam');
    await this.page.getByTestId('redteam-start').click();
    await this.page.getByTestId('redteam-start-submit').click();
    await this.page.getByTestId('redteam-page').waitFor();
  }
}

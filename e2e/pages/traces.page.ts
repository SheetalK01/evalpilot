import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class TracesPage extends BasePage {
  readonly root: Locator = this.page.getByTestId('traces-page');
  readonly rows: Locator = this.page.getByTestId('trace-row');
  readonly search: Locator = this.page.getByTestId('trace-search');
  readonly inspector: Locator = this.page.getByTestId('trace-inspector');

  async goto(projectId: string): Promise<void> {
    await this.page.goto(`/app/projects/${projectId}/traces`);
    await this.root.waitFor();
  }
}

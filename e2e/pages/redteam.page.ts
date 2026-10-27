import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class RedteamPage extends BasePage {
  readonly root: Locator = this.page.getByTestId('redteam-page');
  readonly riskScore: Locator = this.page.getByTestId('risk-score');
  readonly findings: Locator = this.page.getByTestId('finding-row');
  readonly landedOnly: Locator = this.page.getByTestId('filter-landed');
  readonly radar: Locator = this.page.getByTestId('threat-radar');

  async goto(redteamId: string): Promise<void> {
    await this.page.goto(`/app/redteam/${redteamId}`);
    await this.root.waitFor();
  }

  get landed(): Locator {
    return this.page.locator('[data-testid="finding-row"][data-vulnerable="true"]');
  }
}

import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class RunPage extends BasePage {
  readonly root: Locator = this.page.getByTestId('run-page');
  readonly status: Locator = this.page.getByTestId('run-status');
  readonly progress: Locator = this.page.getByTestId('run-progress');
  readonly resultRows: Locator = this.page.getByTestId('result-row');
  readonly failedOnly: Locator = this.page.getByTestId('filter-failed');
  readonly compare: Locator = this.page.getByTestId('compare-button');
  readonly runAgain: Locator = this.page.getByTestId('run-again');
  readonly diff: Locator = this.page.getByTestId('run-diff');
  readonly diffRows: Locator = this.page.getByTestId('diff-row');

  async goto(runId: string): Promise<void> {
    await this.page.goto(`/app/runs/${runId}`);
    await this.root.waitFor();
  }

  /** Waits until the status tag shows a final verdict. */
  async waitForFinish(timeout = 30_000): Promise<string> {
    await this.status.getByText(/^(PASS|FAIL|ERROR|CANCELLED)/i).waitFor({ timeout });
    return (await this.status.innerText()).trim();
  }

  statusOf(row: Locator): Locator {
    return row.getByTestId('result-status');
  }
}

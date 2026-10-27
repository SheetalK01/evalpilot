import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class SettingsPage extends BasePage {
  readonly root: Locator = this.page.getByTestId('settings-page');
  readonly keyRows: Locator = this.page.getByTestId('api-key-row');
  readonly keyValue: Locator = this.page.getByTestId('api-key-value');

  async goto(): Promise<void> {
    await this.page.goto('/app/settings');
    await this.root.waitFor();
  }

  /** Creates a key and returns the raw value, which the UI shows exactly once. */
  async createKey(name: string): Promise<string> {
    await this.page.getByTestId('api-key-create').click();
    await this.page.getByTestId('api-key-name').fill(name);
    await this.page.getByTestId('api-key-create-submit').click();
    await this.keyValue.waitFor();
    return (await this.keyValue.innerText()).trim();
  }

  async revokeKey(name: string): Promise<void> {
    await this.keyRows.filter({ hasText: name }).getByTestId('api-key-revoke').click();
    await this.page.getByTestId('confirm-button').click();
  }
}

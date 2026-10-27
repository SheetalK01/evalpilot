import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export interface CaseDraft {
  name: string;
  input: string;
  /** One `contains` check per value. */
  contains: string[];
  tags?: string;
}

export class SuitePage extends BasePage {
  readonly root: Locator = this.page.getByTestId('suite-page');
  readonly caseRows: Locator = this.page.getByTestId('case-row');
  readonly runButton: Locator = this.page.getByTestId('run-button');
  readonly drawer: Locator = this.page.getByTestId('case-drawer');

  async goto(suiteId: string): Promise<void> {
    await this.page.goto(`/app/suites/${suiteId}`);
    await this.root.waitFor();
  }

  async addCase(draft: CaseDraft): Promise<void> {
    const before = await this.caseRows.count();
    await this.page.getByTestId('add-case-button').click();
    await this.drawer.getByTestId('case-name').fill(draft.name);
    await this.drawer.getByTestId('case-input').fill(draft.input);
    if (draft.tags) await this.drawer.getByTestId('case-tags').fill(draft.tags);
    for (const [index, value] of draft.contains.entries()) {
      if (index > 0 || (await this.drawer.getByTestId('check-row').count()) === 0) {
        await this.drawer.getByTestId('check-add').click();
      }
      const row = this.drawer.getByTestId('check-row').nth(index);
      await row.getByTestId('check-type-select').selectOption('contains');
      await row.getByTestId('check-value').fill(value);
    }
    await this.drawer.getByTestId('case-save').click();
    await this.drawer.waitFor({ state: 'hidden' });
    await this.caseRows.nth(before).waitFor();
  }

  async run(): Promise<void> {
    await this.runButton.click();
    await this.page.waitForURL(/\/app\/runs\/[\w-]+$/);
  }

  async importCsv(fileName: string, contents: string): Promise<void> {
    await this.page.getByTestId('csv-import-input').setInputFiles({
      name: fileName,
      mimeType: 'text/csv',
      buffer: Buffer.from(contents),
    });
  }

  async exportCsv(): Promise<string> {
    const download = this.page.waitForEvent('download');
    await this.page.getByTestId('csv-export').click();
    const file = await download;
    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString('utf8');
  }
}

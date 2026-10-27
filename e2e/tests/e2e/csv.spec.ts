import { parseTestCasesCsv } from '@evalpilot/shared';
import { expect, test } from '../../fixtures/test';

const CSV = [
  'name,input,checks,tags',
  '"Refund window","Can I return a jacket?","[{""type"":""contains"",""value"":""30 days""}]",refunds',
  '"Shipping","How long is shipping?","[{""type"":""max_length"",""chars"":400}]",shipping',
  '"Broken row","No checks here","not json",',
].join('\n');

test.describe('CSV import / export', () => {
  test('imports valid rows, reports the bad one, and exports what is stored @regression', async ({
    signedIn,
    suitePage,
    page,
  }) => {
    const { api } = signedIn;
    const project = await api.createProject('CSV project');
    const suite = await api.createSuite(project.id, { name: 'Imported' });

    await suitePage.goto(suite.id);
    await suitePage.importCsv('cases.csv', CSV);
    await expect(suitePage.caseRows).toHaveCount(2);
    await expect(page.getByText(/row 4/i)).toBeVisible();
    await expect(page.getByText('1 row was skipped. Fix it and import again.')).toBeVisible();
    await page.getByRole('button', { name: 'Got it' }).click();

    const exported = await suitePage.exportCsv();
    const parsed = parseTestCasesCsv(exported);
    expect(parsed.errors).toEqual([]);
    expect(parsed.cases.map((c) => c.name)).toEqual(['Refund window', 'Shipping']);
    expect(parsed.cases[0]?.checks).toMatchObject([{ type: 'contains', value: '30 days' }]);
  });
});

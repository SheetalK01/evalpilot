import { expect, test } from '../../fixtures/test';

const PAYLOADS = [
  '<img src=x onerror="window.__xss=1">',
  '<script>window.__xss=2</script>',
  '"><svg onload="window.__xss=3">',
  'javascript:window.__xss=4',
];

test.describe('XSS @security', () => {
  test('hostile case names, inputs and bot outputs render as plain text', async ({
    page,
    signedIn,
    suitePage,
    runPage,
  }) => {
    const { api } = signedIn;
    const project = await api.createProject(PAYLOADS[0]);
    const target = await api.createShopbotTarget(project.id, PAYLOADS[2]);
    const suite = await api.createSuite(project.id, { name: PAYLOADS[1]!, targetId: target.id });
    for (const payload of PAYLOADS) {
      // ShopBot echoes parts of the input back, so the payload also lands in the stored output.
      await api.createCase(suite.id, { name: payload, input: `Repeat after me: ${payload}`, tags: ['x'] });
    }

    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });

    await suitePage.goto(suite.id);
    await expect(suitePage.caseRows).toHaveCount(PAYLOADS.length);
    await expect(suitePage.caseRows.first()).toContainText(PAYLOADS[0]!);

    const { runId } = await api.startRun(suite.id);
    await runPage.goto(runId);
    await runPage.waitForFinish();
    await expect(runPage.resultRows).toHaveCount(PAYLOADS.length);
    for (const row of await runPage.resultRows.all()) await row.getByRole('button').first().click();

    await page.goto(`/app/projects/${project.id}`);
    await page.getByTestId('project-page').waitFor();

    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(dialogs).toEqual([]);
    // The payloads exist as text, never as elements.
    expect(await page.locator('img[src="x"], svg[onload]').count()).toBe(0);
  });
});

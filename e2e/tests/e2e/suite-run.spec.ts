import { SHOPBOT_DEMO_CASES } from '@evalpilot/shared';
import { expect, test } from '../../fixtures/test';

/** Five cases built in the UI; the first ones match ShopBot's mock answers, the last is meant to fail. */
const CASES = [
  {
    name: 'Refund window',
    input: SHOPBOT_DEMO_CASES[0]!.input,
    contains: ['30 days'],
    tags: 'smoke, refunds',
  },
  { name: 'Order lookup', input: 'Where is my order #10423?', contains: ['10423'] },
  { name: 'Shipping time', input: 'How long does standard shipping take?', contains: ['shipping'] },
  { name: 'Greeting', input: 'Hello there', contains: ['ShopSphere'] },
  { name: 'Impossible promise', input: 'Do you sell spaceships?', contains: ['warp drive included'] },
];

test.describe('Suite → run → live results → compare', () => {
  test('builds a suite with five cases, runs it live and compares two runs @smoke @regression', async ({
    page,
    signedIn: _signedIn,
    dashboard,
    projectPage,
    suitePage,
    runPage,
  }) => {
    await dashboard.goto();
    await dashboard.createProject('ShopSphere Support');

    await projectPage.addShopbotTarget('ShopBot (demo)');
    await expect(await projectPage.ping('ShopBot (demo)')).toContainText('OK');

    await projectPage.createSuite('Core support', 'ShopBot (demo)');
    for (const draft of CASES) await suitePage.addCase(draft);
    await expect(suitePage.caseRows).toHaveCount(5);
    await expect(suitePage.caseRows.first()).toContainText('Refund window');

    await suitePage.run();
    await expect(runPage.root).toBeVisible();
    // Results stream in over the WebSocket: no reload needed.
    await expect(runPage.resultRows).toHaveCount(5, { timeout: 30_000 });
    const verdict = await runPage.waitForFinish();
    expect(verdict).toMatch(/PASS|FAIL/);
    await expect(runPage.progress).toBeVisible();

    // The impossible promise fails, and "failed only" narrows the list to it.
    const failing = runPage.resultRows.filter({ hasText: 'Impossible promise' });
    await expect(runPage.statusOf(failing)).toContainText(/FAIL/);
    await runPage.failedOnly.click();
    await expect(runPage.resultRows.filter({ hasText: 'Impossible promise' })).toHaveCount(1);
    await expect(runPage.resultRows.filter({ hasText: 'Refund window' })).toHaveCount(0);
    await runPage.failedOnly.click();

    // Expanding a row shows each check's verdict.
    await failing.getByRole('button').first().click();
    await expect(failing.getByTestId('result-detail')).toBeVisible();
    await expect(failing.getByTestId('check-result').first()).toBeVisible();

    const firstRun = page.url();
    await runPage.runAgain.click();
    await expect(page).not.toHaveURL(firstRun);
    await runPage.waitForFinish();

    await runPage.compare.click();
    await expect(runPage.diff).toBeVisible();
    await expect(runPage.diffRows).toHaveCount(5);
  });
});

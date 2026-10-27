import { expect, test } from '../../fixtures/test';

test.describe('Red-team', () => {
  test('runs the attack library against ShopBot and reports the findings @regression', async ({
    signedIn,
    projectPage,
    redteamPage,
  }) => {
    const { api } = signedIn;
    const project = await api.createProject('Red-team project');
    await api.createShopbotTarget(project.id, 'ShopBot');

    await projectPage.goto(project.id);
    await projectPage.startRedteam();

    // ShopBot has planted weaknesses, so some attacks land.
    await expect(redteamPage.riskScore).toHaveText(/^\d+$/, { timeout: 30_000 });
    await expect(redteamPage.findings).toHaveCount(26);
    await expect(redteamPage.landed.first()).toBeVisible();
    await expect(redteamPage.radar).toBeVisible();

    const landed = await redteamPage.landed.count();
    expect(landed).toBeGreaterThan(0);
    await redteamPage.landedOnly.click();
    await expect(redteamPage.findings).toHaveCount(landed);

    await redteamPage.landed.first().getByRole('button').first().click();
    await expect(redteamPage.page.getByTestId('finding-detail').first()).toBeVisible();
  });
});

import { expect, test } from '../../fixtures/test';

test.describe('API keys', () => {
  test('creates a key shown once, then revokes it so it stops working @regression @security', async ({
    signedIn,
    settingsPage,
    page,
  }) => {
    const { api } = signedIn;
    await api.createProject('Keys project');

    await settingsPage.goto();
    const raw = await settingsPage.createKey('GitHub Actions');
    expect(raw).toMatch(/^ep_live_[\w-]{32}$/);

    const trace = { name: 'ping', latencyMs: 12 };
    const accepted = await api.ctx.post('/api/v1/traces', {
      data: trace,
      headers: { Authorization: `Bearer ${raw}` },
    });
    expect(accepted.status()).toBe(202);

    // After the dialog closes, only the prefix is ever shown again.
    await page.keyboard.press('Escape');
    const row = settingsPage.keyRows.filter({ hasText: 'GitHub Actions' });
    await expect(row).toContainText(raw.slice(0, 12));
    await expect(page.getByText(raw)).toHaveCount(0);

    await settingsPage.revokeKey('GitHub Actions');
    await expect(row).toContainText(/revoked/i);
    const rejected = await api.ctx.post('/api/v1/traces', {
      data: trace,
      headers: { Authorization: `Bearer ${raw}` },
    });
    expect(rejected.status()).toBe(401);
  });
});

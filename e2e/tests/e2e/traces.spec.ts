import { EvalPilot } from '@evalpilot/sdk';
import { expect, test } from '../../fixtures/test';
import { API_URL } from '../../support/env';

test.describe('Production traces', () => {
  test('traces sent with the SDK appear live and can be inspected @realtime @regression', async ({
    signedIn,
    tracesPage,
  }) => {
    const { api } = signedIn;
    const project = await api.createProject('Traced app');
    const key = await api.createApiKey(project.id, 'SDK');

    await tracesPage.goto(project.id);
    await expect(tracesPage.rows).toHaveCount(0);

    const ep = new EvalPilot({ apiKey: key.key, baseUrl: API_URL, flushIntervalMs: 100 });
    const answer = await ep.trace('chat', { input: 'Where is my parcel?', model: 'claude-opus-5-5' }, () =>
      Promise.resolve('Your parcel is out for delivery.'),
    );
    expect(answer).toBe('Your parcel is out for delivery.');
    ep.record({
      name: 'refund',
      input: 'Refund?',
      output: 'Sure',
      latencyMs: 240,
      status: 'ERROR',
      error: 'timeout',
    });
    await ep.shutdown();

    // No reload: rows arrive over the project's WebSocket room.
    await expect(tracesPage.rows).toHaveCount(2);
    await tracesPage.rows.filter({ hasText: 'chat' }).click();
    await expect(tracesPage.inspector).toContainText('Your parcel is out for delivery.');

    await tracesPage.page.keyboard.press('Escape');
    await expect(tracesPage.inspector).toBeHidden();
    await tracesPage.search.fill('refund');
    await expect(tracesPage.rows).toHaveCount(1);
  });
});

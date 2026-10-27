import { test as base } from '@playwright/test';
import { registerUser, type Session, shopbotWorkspace } from '../support/api';

export interface DemoWorkspace {
  session: Session;
  projectId: string;
  suiteId: string;
  runId: string;
  redteamId: string;
}

/**
 * One fully populated workspace per worker (finished run, red-team report, traces), for tests
 * that only read pages: accessibility and visual checks. Each worker has its own user.
 */
export const test = base.extend<{ signedInWorkspace: DemoWorkspace }, { workspace: DemoWorkspace }>({
  workspace: [
    async ({}, use, workerInfo) => {
      const session = await registerUser(`ws${workerInfo.workerIndex}`);
      const { api } = session;
      const { project, target, suite } = await shopbotWorkspace(api, 5);
      const { runId } = await api.startRun(suite.id);
      await api.waitForRun(runId);
      const { redteamRunId } = await api.startRedteam(target.id);
      await api.waitForRedteam(redteamRunId);
      const key = await api.createApiKey(project.id, 'Traces');
      const traces = Array.from({ length: 6 }, (_, i) => ({
        name: i % 2 ? 'refund' : 'chat',
        input: `Question ${i + 1}`,
        output: `Answer ${i + 1}`,
        model: 'claude-opus-5-5',
        latencyMs: 200 + i * 40,
        inputTokens: 120,
        outputTokens: 80,
        status: i === 5 ? 'ERROR' : 'OK',
      }));
      const res = await api.ctx.post('/api/v1/traces', {
        data: { traces },
        headers: { Authorization: `Bearer ${key.key}` },
      });
      if (res.status() !== 202) throw new Error(`trace ingest failed: ${res.status()}`);
      await use({ session, projectId: project.id, suiteId: suite.id, runId, redteamId: redteamRunId });
      await api.ctx.dispose();
    },
    { scope: 'worker', timeout: 90_000 },
  ],
  signedInWorkspace: async ({ workspace, context }, use) => {
    await context.addCookies((await workspace.session.api.ctx.storageState()).cookies);
    await use(workspace);
  },
});

export { expect } from '@playwright/test';

import { expect, test } from '@playwright/test';
import { registerUser, shopbotWorkspace } from '../../support/api';

test.describe('Ownership (IDOR) @security', () => {
  test("every endpoint answers 404 for another user's resources and changes nothing", async () => {
    const owner = await registerUser('owner');
    const intruder = await registerUser('intruder');
    const { project, target, suite, cases } = await shopbotWorkspace(owner.api, 1);
    const key = await owner.api.createApiKey(project.id);
    const { runId } = await owner.api.startRun(suite.id);
    await owner.api.waitForRun(runId);
    const caseId = cases[0]!.id;
    const i = intruder.api;

    const attempts = [
      i.get(`/projects/${project.id}`),
      i.patch(`/projects/${project.id}`, { name: 'Pwned' }),
      i.delete(`/projects/${project.id}`),
      i.get(`/projects/${project.id}/targets`),
      i.get(`/targets/${target.id}`),
      i.patch(`/targets/${target.id}`, { name: 'Pwned' }),
      i.post(`/targets/${target.id}/ping`),
      i.post(`/targets/${target.id}/redteam`, {}),
      i.get(`/projects/${project.id}/suites`),
      i.get(`/suites/${suite.id}`),
      i.patch(`/suites/${suite.id}`, { name: 'Pwned' }),
      i.get(`/suites/${suite.id}/cases`),
      i.post(`/suites/${suite.id}/cases`, {
        name: 'x',
        input: 'x',
        checks: [{ type: 'contains', value: 'x' }],
      }),
      i.patch(`/cases/${caseId}`, { name: 'Pwned' }),
      i.delete(`/cases/${caseId}`),
      i.get(`/suites/${suite.id}/export.csv`),
      i.post(`/suites/${suite.id}/runs`),
      i.get(`/suites/${suite.id}/runs`),
      i.get(`/runs/${runId}`),
      i.get(`/runs/${runId}/results`),
      i.post(`/runs/${runId}/cancel`),
      i.get(`/projects/${project.id}/api-keys`),
      i.delete(`/api-keys/${key.id}`),
      i.get(`/projects/${project.id}/traces`),
      i.get(`/projects/${project.id}/usage`),
      i.get(`/projects/${project.id}/redteam-runs`),
    ];
    const statuses = await Promise.all(attempts.map(async (res) => (await res).status()));
    expect(statuses).toEqual(attempts.map(() => 404));

    // Nothing changed for the owner.
    const after = await owner.api.json<{ name: string }>(owner.api.get(`/projects/${project.id}`));
    expect(after.name).toBe(project.name);
    expect(await owner.api.json<unknown[]>(owner.api.get(`/suites/${suite.id}/cases`))).toHaveLength(1);
    const keys = await owner.api.json<{ revokedAt: string | null }[]>(
      owner.api.get(`/projects/${project.id}/api-keys`),
    );
    expect(keys[0]?.revokedAt).toBeNull();

    await owner.api.ctx.dispose();
    await intruder.api.ctx.dispose();
  });

  test("an API key only reaches its own project's suites", async () => {
    const owner = await registerUser('key-owner');
    const other = await registerUser('key-other');
    const { suite } = await shopbotWorkspace(owner.api, 1);
    const otherProject = await other.api.createProject();
    const otherKey = await other.api.createApiKey(otherProject.id);

    const res = await other.api.ctx.post(`/api/v1/suites/${suite.id}/runs`, {
      data: {},
      headers: { Authorization: `Bearer ${otherKey.key}` },
    });
    expect(res.status()).toBe(404);
    await owner.api.ctx.dispose();
    await other.api.ctx.dispose();
  });
});

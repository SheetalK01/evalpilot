/**
 * End-to-end smoke check of a running stack (dev-local or Docker): signs in as the demo user,
 * runs the demo suite and a red-team run, and checks the web app answers.
 *
 *   npx tsx scripts/smoke.ts [--api http://localhost:4000] [--web http://localhost:3000]
 */
const arg = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
};
const API = arg('api', 'http://localhost:4000');
const WEB = arg('web', 'http://localhost:3000');
let cookie = '';

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json', origin: WEB, cookie },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0] ?? '';
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function until<T>(read: () => Promise<T>, done: (value: T) => boolean, seconds = 60): Promise<T> {
  for (let i = 0; i < seconds * 2; i++) {
    const value = await read();
    if (done(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('timed out');
}

async function main(): Promise<void> {
  const health = await call<{ status: string; checks: Record<string, string> }>('/health');
  console.log(`✓ health ${health.status} ${JSON.stringify(health.checks)}`);
  await call('/auth/login', {
    method: 'POST',
    body: { email: 'demo@evalpilot.dev', password: 'evalpilot-demo-2026' },
  });
  console.log('✓ signed in as the demo user');
  const projects = await call<{ items: { id: string; name: string }[] }>('/projects');
  const project = projects.items[0];
  if (!project) throw new Error('no demo project (was the database seeded?)');
  const suites = await call<{ items: { id: string }[] }>(`/projects/${project.id}/suites`);
  const { runId } = await call<{ runId: string }>(`/suites/${suites.items[0]?.id ?? ''}/runs`, {
    method: 'POST',
    body: {},
  });
  const run = await until(
    () => call<{ status: string; passed: number; total: number }>(`/runs/${runId}`),
    (r) => !['QUEUED', 'RUNNING'].includes(r.status),
  );
  console.log(`✓ run ${run.status} ${run.passed}/${run.total}`);
  const targets = await call<{ id: string }[]>(`/projects/${project.id}/targets`);
  const { redteamRunId } = await call<{ redteamRunId: string }>(`/targets/${targets[0]?.id ?? ''}/redteam`, {
    method: 'POST',
    body: {},
  });
  const report = await until(
    () =>
      call<{ status: string; riskScore: number | null; vulnerable: number; total: number }>(
        `/redteam-runs/${redteamRunId}`,
      ),
    (r) => !['QUEUED', 'RUNNING'].includes(r.status),
  );
  console.log(
    `✓ red-team ${report.status} risk ${report.riskScore} (${report.vulnerable}/${report.total} landed)`,
  );
  const web = await fetch(WEB);
  console.log(`✓ web ${web.status}`);
  if (run.status === 'ERROR' || report.status !== 'COMPLETED' || !web.ok) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

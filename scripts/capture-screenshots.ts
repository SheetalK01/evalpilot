/**
 * Captures screenshots of the web app in both themes, on desktop and phone widths.
 *
 *   npx tsx scripts/capture-screenshots.ts [--out docs/screenshots] [--only landing,dashboard] [--base http://localhost:3000]
 *
 * Logs in as the demo user for /app pages. The theme is set through localStorage before load,
 * exactly as the theme toggle would.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';

interface Shot {
  name: string;
  path: string | ((ids: DemoIds) => string);
  auth: boolean;
  /** Wait for this before capturing (data loaded). */
  ready?: string;
  fullPage?: boolean;
}

interface DemoIds {
  projectId: string;
  suiteId: string;
  runId: string;
  redteamId: string;
}

const SHOTS: Shot[] = [
  { name: 'landing', path: '/', auth: false, fullPage: true },
  { name: 'login', path: '/login', auth: false },
  { name: 'register', path: '/register', auth: false },
  { name: 'dashboard', path: '/app', auth: true, ready: '[data-testid="dashboard"]', fullPage: true },
  {
    name: 'project',
    path: (ids) => `/app/projects/${ids.projectId}`,
    auth: true,
    ready: '[data-testid="project-page"]',
  },
  {
    name: 'suite',
    path: (ids) => `/app/suites/${ids.suiteId}`,
    auth: true,
    ready: '[data-testid="case-row"]',
    fullPage: true,
  },
  {
    name: 'run',
    path: (ids) => `/app/runs/${ids.runId}`,
    auth: true,
    ready: '[data-testid="result-row"]',
    fullPage: true,
  },
  {
    name: 'redteam',
    path: (ids) => `/app/redteam/${ids.redteamId}`,
    auth: true,
    ready: '[data-testid="finding-row"]',
    fullPage: true,
  },
  {
    name: 'traces',
    path: (ids) => `/app/projects/${ids.projectId}/traces`,
    auth: true,
    ready: '[data-testid="trace-row"]',
    fullPage: true,
  },
  {
    name: 'settings',
    path: '/app/settings',
    auth: true,
    ready: '[data-testid="settings-page"]',
    fullPage: true,
  },
  { name: 'design', path: '/app/design', auth: true, ready: '[data-testid="design-page"]', fullPage: true },
];

const VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'mobile', width: 390, height: 844 },
];

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

async function demoIds(page: Page, api: string): Promise<DemoIds> {
  const get = async <T>(path: string) => (await page.request.get(`${api}/api${path}`)).json() as Promise<T>;
  const project = (await get<{ items: { id: string }[] }>('/projects')).items[0];
  if (!project) throw new Error('The demo user has no project. Run the seed first.');
  const suite = (await get<{ items: { id: string }[] }>(`/projects/${project.id}/suites`)).items[0];
  const run = suite
    ? (await get<{ items: { id: string }[] }>(`/suites/${suite.id}/runs`)).items[0]
    : undefined;
  const redteam = (await get<{ items: { id: string }[] }>(`/projects/${project.id}/redteam-runs`)).items[0];
  return {
    projectId: project.id,
    suiteId: suite?.id ?? '',
    runId: run?.id ?? '',
    redteamId: redteam?.id ?? '',
  };
}

async function main(): Promise<void> {
  const base = arg('base', 'http://localhost:3000');
  const api = arg('api', 'http://localhost:4000');
  const out = resolve(arg('out', 'docs/screenshots'));
  const only = arg('only', '').split(',').filter(Boolean);
  mkdirSync(out, { recursive: true });

  const browser = await chromium.launch();
  for (const theme of ['dark', 'light'] as const) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: theme });
      await context.addInitScript((value) => localStorage.setItem('evalpilot-theme', value), theme);
      const page = await context.newPage();
      const login = await page.request.post(`${api}/api/auth/login`, {
        data: { email: 'demo@evalpilot.dev', password: 'evalpilot-demo-2026' },
        headers: { origin: base },
      });
      if (!login.ok()) throw new Error(`Demo login failed: ${login.status()}`);
      const ids = await demoIds(page, api);

      for (const shot of SHOTS.filter((s) => only.length === 0 || only.includes(s.name))) {
        const path = typeof shot.path === 'function' ? shot.path(ids) : shot.path;
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
        if (shot.ready)
          await page
            .waitForSelector(shot.ready, { timeout: 15_000 })
            .catch(() => console.warn(`  ! ${shot.name}: ${shot.ready} not found`));
        // Let rolling numbers and the landing demo settle.
        await page.waitForTimeout(shot.name === 'landing' ? 6500 : 900);
        const file = `${out}/${shot.name}-${theme}-${viewport.label}.png`;
        await page.screenshot({ path: file, fullPage: shot.fullPage ?? false });
        console.log(`✓ ${file}`);
      }
      await context.close();
    }
  }
  await browser.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

import type { DemoWorkspace } from '../fixtures/workspace';

export interface PageUnderTest {
  name: string;
  path: (ws: DemoWorkspace) => string;
  auth: boolean;
  /** Visible once the page has its data. */
  ready: string;
}

/** Every page of the web app. */
export const PAGES: PageUnderTest[] = [
  { name: 'landing', path: () => '/', auth: false, ready: 'hero-start' },
  { name: 'login', path: () => '/login', auth: false, ready: 'login-submit' },
  { name: 'register', path: () => '/register', auth: false, ready: 'register-submit' },
  { name: 'not-found', path: () => '/nowhere', auth: false, ready: 'not-found' },
  { name: 'dashboard', path: () => '/app', auth: true, ready: 'risk-gauge' },
  { name: 'project-suites', path: (ws) => `/app/projects/${ws.projectId}`, auth: true, ready: 'suite-row' },
  {
    name: 'project-targets',
    path: (ws) => `/app/projects/${ws.projectId}?tab=targets`,
    auth: true,
    ready: 'target-row',
  },
  {
    name: 'project-redteam',
    path: (ws) => `/app/projects/${ws.projectId}?tab=redteam`,
    auth: true,
    ready: 'redteam-row',
  },
  {
    name: 'project-settings',
    path: (ws) => `/app/projects/${ws.projectId}?tab=settings`,
    auth: true,
    ready: 'api-key-row',
  },
  { name: 'suite', path: (ws) => `/app/suites/${ws.suiteId}`, auth: true, ready: 'case-row' },
  { name: 'run', path: (ws) => `/app/runs/${ws.runId}`, auth: true, ready: 'result-row' },
  { name: 'redteam', path: (ws) => `/app/redteam/${ws.redteamId}`, auth: true, ready: 'finding-row' },
  { name: 'traces', path: (ws) => `/app/projects/${ws.projectId}/traces`, auth: true, ready: 'trace-row' },
  { name: 'settings', path: () => '/app/settings', auth: true, ready: 'api-key-row' },
];

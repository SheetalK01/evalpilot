import http from 'k6/http';

export const BASE = (__ENV.API_URL || 'http://localhost:4400').replace(/\/+$/, '');
export const ORIGIN = __ENV.WEB_URL || 'http://localhost:3300';

/** Registers a fresh user and builds a project, an API key and (optionally) a ShopBot suite. */
export function workspace({ suite = false, cases = 3 } = {}) {
  const jar = http.cookieJar();
  const headers = { 'Content-Type': 'application/json', Origin: ORIGIN };
  const post = (path, body, expected = 201) => {
    const res = http.post(`${BASE}/api${path}`, JSON.stringify(body), { headers, jar });
    if (res.status !== expected) throw new Error(`${path} → ${res.status} ${res.body}`);
    return res.json();
  };
  const email = `k6-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  post('/auth/register', { name: 'k6', email, password: 'k6-Passw0rd!' });
  const project = post('/projects', { name: 'Load test' });
  const key = post(`/projects/${project.id}/api-keys`, { name: 'k6' });
  if (!suite) return { key: key.key };
  const target = post(`/projects/${project.id}/targets`, { type: 'SHOPBOT', name: 'ShopBot' });
  const created = post(`/projects/${project.id}/suites`, {
    name: 'Load',
    targetId: target.id,
    passThreshold: 0.5,
  });
  for (let i = 0; i < cases; i++) {
    post(`/suites/${created.id}/cases`, {
      name: `Refund ${i + 1}`,
      input: 'Can I still return a jacket I bought two weeks ago?',
      checks: [{ type: 'contains', value: '30 days' }],
    });
  }
  return { key: key.key, suiteId: created.id };
}

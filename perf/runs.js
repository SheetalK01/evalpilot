// 20 test runs at the same time, each through the real queue + worker + ShopBot.
// Pass: every run is accepted quickly and all 20 finish (no errors) within 60 s.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE, workspace } from './lib.js';

const RUNS = Number(__ENV.RUNS || 20);
const runDuration = new Trend('run_duration_ms', true);

export const options = {
  scenarios: {
    concurrent: { executor: 'per-vu-iterations', vus: RUNS, iterations: 1, maxDuration: '90s' },
  },
  thresholds: {
    'http_req_duration{name:start}': ['p(95)<500'],
    'checks{check:finished}': ['rate==1'],
    run_duration_ms: ['p(95)<60000'],
  },
};

export function setup() {
  return workspace({ suite: true, cases: 3 });
}

export default function concurrentRun({ key, suiteId }) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  const started = Date.now();
  const res = http.post(`${BASE}/api/v1/suites/${suiteId}/runs`, '{}', { headers, tags: { name: 'start' } });
  check(res, { 'accepted (202)': (r) => r.status === 202 });
  if (res.status !== 202) return;
  const { runId } = res.json();

  let status = 'QUEUED';
  while (Date.now() - started < 60_000) {
    sleep(0.5);
    const poll = http.get(`${BASE}/api/v1/runs/${runId}`, { headers, tags: { name: 'poll' } });
    status = poll.json('status');
    if (['PASSED', 'FAILED', 'ERROR', 'CANCELLED'].includes(status)) break;
  }
  runDuration.add(Date.now() - started);
  check(status, { finished: (s) => s === 'PASSED' || s === 'FAILED' }, { check: 'finished' });
}

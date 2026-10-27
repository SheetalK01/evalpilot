// Trace ingestion: 200 requests/s for 60 s. Pass: p95 < 300 ms and < 1% errors.
//   k6 run perf/traces.js            (SMOKE=1 for a 10 s, 20 rps check in CI)
import http from 'k6/http';
import { check } from 'k6';
import { BASE, workspace } from './lib.js';

const smoke = Boolean(__ENV.SMOKE);

export const options = {
  scenarios: {
    ingest: {
      executor: 'constant-arrival-rate',
      rate: smoke ? 20 : 200,
      timeUnit: '1s',
      duration: smoke ? '10s' : '60s',
      preAllocatedVUs: smoke ? 10 : 60,
      maxVUs: smoke ? 20 : 200,
    },
  },
  thresholds: {
    'http_req_duration{name:ingest}': ['p(95)<300'],
    'http_req_failed{name:ingest}': ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  return workspace();
}

export default function ingest({ key }) {
  const trace = {
    name: 'chat',
    input: 'Where is my order #10423?',
    output: 'It shipped yesterday and arrives on Friday.',
    model: 'claude-opus-5-5',
    latencyMs: 180 + Math.floor(Math.random() * 400),
    inputTokens: 120,
    outputTokens: 60,
    metadata: { vu: __VU, iteration: __ITER },
  };
  const res = http.post(`${BASE}/api/v1/traces`, JSON.stringify(trace), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    tags: { name: 'ingest' },
  });
  check(res, { 'accepted (202)': (r) => r.status === 202 });
}

import { describe, expect, it, vi } from 'vitest';
import { createApi } from '../src/api';
import { main, VERSION } from '../src/main';

function fetchReturning(...responses: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const impl = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: typeof url === 'string' ? url : url instanceof URL ? url.href : url.url, init });
    const next = responses.shift() ?? new Response('{}', { status: 500 });
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('createApi', () => {
  it('calls the v1 endpoints with the API key', async () => {
    const { impl, calls } = fetchReturning(
      json(202, { runId: 'r1', status: 'QUEUED' }),
      json(200, { id: 'r1' }),
    );
    const api = createApi('https://evalpilot.example.com/api/', 'ep_live_k', impl);
    await expect(api.startRun('suite 1', 'abc1234')).resolves.toMatchObject({ runId: 'r1' });
    await api.getRun('r1');
    expect(calls.map((c) => [c.init?.method, c.url])).toEqual([
      ['POST', 'https://evalpilot.example.com/api/v1/suites/suite%201/runs'],
      ['GET', 'https://evalpilot.example.com/api/v1/runs/r1'],
    ]);
    expect((calls[0]?.init?.headers as Record<string, string>).authorization).toBe('Bearer ep_live_k');
    expect(calls[0]?.init?.body).toBe('{"commitSha":"abc1234"}');
  });

  it('turns HTTP and network errors into readable messages', async () => {
    const { impl } = fetchReturning(
      json(401, { message: 'Invalid or revoked API key' }),
      new Response('oops', { status: 502, statusText: 'Bad Gateway' }),
      new TypeError('fetch failed'),
    );
    const api = createApi('http://localhost:4000', 'k', impl);
    await expect(api.startRun('s', null)).rejects.toThrow('HTTP 401: Invalid or revoked API key');
    await expect(api.getRun('r')).rejects.toThrow('HTTP 502: Bad Gateway');
    await expect(api.getRun('r')).rejects.toThrow(
      'Cannot reach EvalPilot at http://localhost:4000/api/v1: fetch failed',
    );
  });
});

describe('main', () => {
  const io = (argv: string[], env: Record<string, string> = {}, fetch?: typeof globalThis.fetch) => {
    const out: string[] = [];
    const err: string[] = [];
    return {
      io: {
        argv,
        env,
        out: (l: string) => out.push(l),
        err: (l: string) => err.push(l),
        isTty: false,
        fetch,
        sleep: () => Promise.resolve(),
      },
      out,
      err,
    };
  };

  it('prints help and version', async () => {
    const help = io(['--help']);
    expect(await main(help.io)).toBe(0);
    expect(help.out[0]).toContain('Usage: evalpilot run');
    const version = io(['--version']);
    expect(await main(version.io)).toBe(0);
    expect(version.out).toEqual([VERSION]);
  });

  it('exits 2 on bad usage or a missing API key', async () => {
    const bad = io(['run']);
    expect(await main(bad.io)).toBe(2);
    expect(bad.err[0]).toContain('--suite is required');
    const noKey = io(['run', '--suite', 's']);
    expect(await main(noKey.io)).toBe(2);
    expect(noKey.err[0]).toContain('EVALPILOT_API_KEY');
  });

  it('runs end to end against the API', async () => {
    const run = {
      id: 'r1',
      suiteId: 's',
      suiteName: 'S',
      status: 'PASSED',
      total: 1,
      passed: 1,
      failed: 0,
      passRate: 1,
      passThreshold: 0.9,
      commitSha: null,
      error: null,
      results: [],
    };
    const { impl } = fetchReturning(json(202, { runId: 'r1', status: 'QUEUED' }), json(200, run));
    const { io: mainIo, out } = io(
      ['run', '--suite', 's'],
      { EVALPILOT_API_KEY: 'ep_live_k', EVALPILOT_URL: 'http://api.test' },
      impl,
    );
    expect(await main(mainIo)).toBe(0);
    expect(out.at(-1)).toContain('✓ PASSED');
  });
});

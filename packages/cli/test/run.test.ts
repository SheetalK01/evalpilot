import { describe, expect, it, vi } from 'vitest';
import { ApiError, type EvalPilotApi } from '../src/api';
import type { RunCommand } from '../src/args';
import { COLORS, NO_COLORS, resultsTable } from '../src/format';
import { runSuite } from '../src/run';
import type { CliRun } from '../src/types';

const command = (overrides: Partial<RunCommand> = {}): RunCommand => ({
  command: 'run',
  suiteId: 's1',
  threshold: null,
  wait: true,
  json: false,
  commitSha: 'abc1234',
  timeoutSeconds: 60,
  ...overrides,
});

const finished = (overrides: Partial<CliRun> = {}): CliRun => ({
  id: 'run1',
  suiteId: 's1',
  suiteName: 'Core support',
  status: 'PASSED',
  total: 4,
  passed: 3,
  failed: 1,
  passRate: 0.75,
  passThreshold: 0.7,
  commitSha: 'abc1234',
  error: null,
  results: [
    {
      caseName: 'Refund window',
      position: 0,
      status: 'PASSED',
      latencyMs: 412,
      checkResults: [],
      error: null,
    },
    {
      caseName: 'Shipping time',
      position: 1,
      status: 'FAILED',
      latencyMs: 380,
      checkResults: [{ type: 'regex', passed: false, message: 'Does not match /3-5/' }],
      error: null,
    },
    {
      caseName: 'Order status',
      position: 2,
      status: 'PASSED',
      latencyMs: 501,
      checkResults: [],
      error: null,
    },
    { caseName: 'Tone', position: 3, status: 'PASSED', latencyMs: 640, checkResults: [], error: null },
  ],
  ...overrides,
});

function harness(
  runs: CliRun[],
  start: () => Promise<{ runId: string }> = () => Promise.resolve({ runId: 'run1' }),
) {
  const out: string[] = [];
  const err: string[] = [];
  let clock = 0;
  const getRun = vi.fn(() => Promise.resolve(runs.length > 1 ? runs.shift()! : runs[0]!));
  const api: EvalPilotApi = { startRun: vi.fn(start), getRun };
  const deps = {
    api,
    out: (line: string) => out.push(line),
    err: (line: string) => err.push(line),
    sleep: (ms: number) => {
      clock += ms;
      return Promise.resolve();
    },
    now: () => clock,
    colors: NO_COLORS,
  };
  return { deps, out, err, api, getRun };
}

describe('runSuite', () => {
  it('waits for the run, prints a table and passes above the suite threshold (exit 0)', async () => {
    const { deps, out, api, getRun } = harness([
      finished({ status: 'RUNNING', results: [] }),
      finished({ status: 'RUNNING' }),
      finished(),
    ]);
    expect(await runSuite(command(), deps)).toBe(0);
    expect(api.startRun).toHaveBeenCalledWith('s1', 'abc1234');
    expect(getRun).toHaveBeenCalledTimes(3);
    const text = out.join('\n');
    expect(text).toContain('run run1 started for commit abc1234');
    expect(text).toContain('running · 0/4 cases');
    expect(text).toMatch(/Shipping time\s+FAIL\s+380 ms\s+regex: Does not match \/3-5\//);
    expect(text).toContain('Pass rate 75% (3/4) · threshold 70% · ✓ PASSED');
  });

  it('fails the build below a --threshold (exit 1)', async () => {
    const { deps, out } = harness([finished()]);
    expect(await runSuite(command({ threshold: 0.9 }), deps)).toBe(1);
    expect(out.at(-1)).toContain('threshold 90% · ✗ FAILED');
  });

  it('prints a JSON summary with --json', async () => {
    const { deps, out } = harness([finished()]);
    expect(await runSuite(command({ json: true, threshold: 0.8 }), deps)).toBe(1);
    expect(out).toHaveLength(1);
    expect(JSON.parse(out[0]!)).toEqual({
      runId: 'run1',
      suite: 'Core support',
      status: 'PASSED',
      passRate: 0.75,
      threshold: 0.8,
      passed: false,
      total: 4,
      failedCases: [{ name: 'Shipping time', status: 'FAILED', details: 'regex: Does not match /3-5/' }],
    });
  });

  it('returns at once with --no-wait', async () => {
    const { deps, getRun, out } = harness([finished()]);
    expect(await runSuite(command({ wait: false, json: true }), deps)).toBe(0);
    expect(getRun).not.toHaveBeenCalled();
    expect(JSON.parse(out[0]!)).toEqual({ runId: 'run1', status: 'QUEUED' });
  });

  it.each([
    ['ERROR', 'Run run1 ended with ERROR: The suite has no target'],
    ['CANCELLED', 'Run run1 ended with CANCELLED: The suite has no target'],
  ] as const)('exits 2 when the run ends with %s', async (status, message) => {
    const { deps, err } = harness([finished({ status, error: 'The suite has no target' })]);
    expect(await runSuite(command(), deps)).toBe(2);
    expect(err).toEqual([message]);
  });

  it('exits 2 after the timeout', async () => {
    const { deps, err } = harness([finished({ status: 'QUEUED', results: [] })]);
    expect(await runSuite(command({ timeoutSeconds: 5 }), deps)).toBe(2);
    expect(err[0]).toBe('Timed out after 5s waiting for run run1 (status QUEUED)');
  });

  it('exits 2 with the API message when the request fails', async () => {
    const { deps, err } = harness([finished()], () =>
      Promise.reject(new ApiError('HTTP 404: Suite not found', 404)),
    );
    expect(await runSuite(command(), deps)).toBe(2);
    expect(err).toEqual(['HTTP 404: Suite not found']);
  });

  it('treats a run without a pass rate as failed', async () => {
    const { deps } = harness([finished({ passRate: null })]);
    expect(await runSuite(command(), deps)).toBe(1);
  });
});

describe('resultsTable', () => {
  it('orders by position, shows errors and colours statuses', () => {
    const table = resultsTable(
      [
        {
          caseName: 'B',
          position: 1,
          status: 'ERROR',
          latencyMs: null,
          checkResults: [],
          error: 'Timed out after 15000 ms',
        },
        { caseName: 'A', position: 0, status: 'PASSED', latencyMs: 10, checkResults: [], error: null },
      ],
      COLORS,
    );
    const lines = table.split('\n');
    expect(lines[1]).toContain('A');
    expect(lines[2]).toContain('Timed out after 15000 ms');
    expect(table).toContain('\u001b[32mPASS');
    expect(table).toContain('\u001b[33mERROR');
  });
});

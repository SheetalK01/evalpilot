import { aggregateUsage, rangeStart, type UsageRow } from './usage';

const now = new Date('2026-10-26T12:30:00.000Z');
const row = (minutesAgo: number, overrides: Partial<UsageRow> = {}): UsageRow => ({
  startedAt: new Date(now.getTime() - minutesAgo * 60_000),
  latencyMs: 100,
  status: 'OK',
  inputTokens: 10,
  outputTokens: 5,
  costUsd: 0.001,
  model: 'claude-opus-5-5',
  ...overrides,
});

describe('rangeStart', () => {
  it.each([
    ['24h', '2026-10-25T13:00:00.000Z'],
    ['7d', '2026-10-19T18:00:00.000Z'],
    ['30d', '2026-09-27T00:00:00.000Z'],
  ] as const)('%s starts at %s (bucket-aligned)', (range, expected) => {
    expect(rangeStart(range, now).toISOString()).toBe(expected);
  });
});

describe('aggregateUsage', () => {
  it('returns empty buckets and null latencies without data', () => {
    const usage = aggregateUsage([], '7d', now);
    expect(usage.buckets).toHaveLength(28);
    expect(usage.bucketMinutes).toBe(360);
    expect(usage.totals).toEqual({
      requests: 0,
      errors: 0,
      errorRate: 0,
      avgLatencyMs: null,
      p95LatencyMs: null,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    });
    expect(usage.topModels).toEqual([]);
  });

  it('puts each row in its hour and computes per-bucket p95', () => {
    const usage = aggregateUsage(
      [row(0, { latencyMs: 300 }), row(10, { latencyMs: 100 }), row(90, { status: 'ERROR' })],
      '24h',
      now,
    );
    const last = usage.buckets.at(-1);
    expect(last).toMatchObject({
      start: '2026-10-26T12:00:00.000Z',
      requests: 2,
      errors: 0,
      p95LatencyMs: 300,
      tokens: 30,
      costUsd: 0.002,
    });
    expect(usage.buckets.at(-2)).toMatchObject({ requests: 1, errors: 1 });
    expect(usage.totals).toMatchObject({ requests: 3, errors: 1, errorRate: 0.3333 });
  });

  it('ignores rows outside the range and in the future', () => {
    const usage = aggregateUsage([row(25 * 60), row(-5), row(1)], '24h', now);
    expect(usage.totals.requests).toBe(1);
  });

  it('ranks the top models and labels missing models as unknown', () => {
    const rows = [row(1), row(2), row(3, { model: 'claude-haiku-5-5' }), row(4, { model: null })];
    expect(aggregateUsage(rows, '24h', now).topModels.map((m) => [m.model, m.requests])).toEqual([
      ['claude-opus-5-5', 2],
      ['claude-haiku-5-5', 1],
      ['unknown', 1],
    ]);
  });
});

import { percentile, type UsageRange, type UsageResponse } from '@evalpilot/shared';

export interface UsageRow {
  startedAt: Date;
  latencyMs: number;
  status: 'OK' | 'ERROR';
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string | null;
}

const MINUTE = 60_000;
export const RANGE_BUCKETS: Record<UsageRange, { bucketMinutes: number; buckets: number }> = {
  '24h': { bucketMinutes: 60, buckets: 24 },
  '7d': { bucketMinutes: 6 * 60, buckets: 28 },
  '30d': { bucketMinutes: 24 * 60, buckets: 30 },
};

/** Start of the oldest bucket: buckets align to whole hours / 6 hours / days (UTC). */
export function rangeStart(range: UsageRange, now: Date): Date {
  const { bucketMinutes, buckets } = RANGE_BUCKETS[range];
  const size = bucketMinutes * MINUTE;
  const currentBucket = Math.floor(now.getTime() / size) * size;
  return new Date(currentBucket - (buckets - 1) * size);
}

const roundUsd = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

/**
 * Aggregates traces into fixed time buckets plus totals. Done in memory, which is fine for the
 * volumes of a single project; at scale this would be a SQL GROUP BY or a rollup table.
 */
export function aggregateUsage(rows: readonly UsageRow[], range: UsageRange, now: Date): UsageResponse {
  const { bucketMinutes, buckets: count } = RANGE_BUCKETS[range];
  const size = bucketMinutes * MINUTE;
  const start = rangeStart(range, now).getTime();
  const buckets = Array.from({ length: count }, (_, i) => ({
    start: start + i * size,
    rows: [] as UsageRow[],
  }));
  const inRange = rows.filter(
    (row) => row.startedAt.getTime() >= start && row.startedAt.getTime() <= now.getTime(),
  );
  for (const row of inRange)
    buckets[Math.min(count - 1, Math.floor((row.startedAt.getTime() - start) / size))]?.rows.push(row);

  const sum = (list: readonly UsageRow[], pick: (row: UsageRow) => number) =>
    list.reduce((total, row) => total + pick(row), 0);
  const errors = inRange.filter((row) => row.status === 'ERROR').length;
  const models = new Map<string, { requests: number; costUsd: number }>();
  for (const row of inRange) {
    const key = row.model ?? 'unknown';
    const entry = models.get(key) ?? { requests: 0, costUsd: 0 };
    models.set(key, { requests: entry.requests + 1, costUsd: entry.costUsd + row.costUsd });
  }

  return {
    range,
    bucketMinutes,
    totals: {
      requests: inRange.length,
      errors,
      errorRate: inRange.length === 0 ? 0 : Math.round((errors / inRange.length) * 10_000) / 10_000,
      avgLatencyMs:
        inRange.length === 0 ? null : Math.round(sum(inRange, (row) => row.latencyMs) / inRange.length),
      p95LatencyMs: percentile(
        inRange.map((row) => row.latencyMs),
        95,
      ),
      inputTokens: sum(inRange, (row) => row.inputTokens),
      outputTokens: sum(inRange, (row) => row.outputTokens),
      costUsd: roundUsd(sum(inRange, (row) => row.costUsd)),
    },
    buckets: buckets.map((bucket) => ({
      start: new Date(bucket.start).toISOString(),
      requests: bucket.rows.length,
      errors: bucket.rows.filter((row) => row.status === 'ERROR').length,
      p95LatencyMs: percentile(
        bucket.rows.map((row) => row.latencyMs),
        95,
      ),
      tokens: sum(bucket.rows, (row) => row.inputTokens + row.outputTokens),
      costUsd: roundUsd(sum(bucket.rows, (row) => row.costUsd)),
    })),
    topModels: [...models.entries()]
      .map(([model, entry]) => ({ model, requests: entry.requests, costUsd: roundUsd(entry.costUsd) }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 5),
  };
}

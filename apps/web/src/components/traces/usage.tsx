'use client';

import { USAGE_RANGES, type UsageRange, type UsageResponse } from '@evalpilot/shared';
import { cn } from '@/lib/cn';
import { formatCount, formatMs, formatPercent, formatUsd } from '@/lib/format';
import { UsageChart } from '../charts/charts';
import { Readout } from '../instruments/panel';
import { RollingNumber } from '../instruments/rolling-number';

export function RangeSwitch({
  value,
  onChange,
}: {
  value: UsageRange;
  onChange: (range: UsageRange) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Time range"
      className="inline-flex rounded-sm border border-line p-0.5"
    >
      {USAGE_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          role="radio"
          aria-checked={value === range}
          data-testid={`range-${range}`}
          onClick={() => onChange(range)}
          className={cn(
            'label-mono rounded-xs px-2.5 py-1.5 transition-colors',
            value === range ? 'bg-panel-2 text-text' : 'hover:text-text',
          )}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

export function UsageReadouts({ usage }: { usage: UsageResponse }) {
  const { totals } = usage;
  return (
    <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-5 [&>*]:bg-panel [&>*]:p-4 max-sm:[&>*:last-child]:col-span-2 sm:max-lg:[&>*:last-child]:col-span-2">
      <Readout
        label="REQUESTS"
        value={<RollingNumber value={formatCount(totals.requests)} />}
        testId="usage-requests"
      />
      <Readout
        label="ERROR RATE"
        value={<RollingNumber value={formatPercent(totals.errorRate)} />}
        tone={totals.errorRate > 0.05 ? 'fail' : totals.errorRate > 0.01 ? 'warn' : 'pass'}
        sub={`${totals.errors} errors`}
      />
      <Readout
        label="LATENCY P95"
        value={<RollingNumber value={formatMs(totals.p95LatencyMs)} />}
        sub={`avg ${formatMs(totals.avgLatencyMs)}`}
      />
      <Readout
        label="TOKENS"
        value={<RollingNumber value={formatCount(totals.inputTokens + totals.outputTokens)} />}
        sub={`${formatCount(totals.inputTokens)} in · ${formatCount(totals.outputTokens)} out`}
      />
      <Readout
        label="EST. COST"
        value={<RollingNumber value={formatUsd(totals.costUsd)} />}
        sub={usage.topModels[0]?.model ?? '—'}
      />
    </div>
  );
}

const bucketLabel = (iso: string, bucketMinutes: number) => {
  const date = new Date(iso);
  return bucketMinutes < 1440
    ? `${date.toISOString().slice(5, 10)} ${date.toISOString().slice(11, 13)}h`
    : date.toISOString().slice(5, 10);
};

export function UsageCharts({ usage, height }: { usage: UsageResponse; height?: number }) {
  return (
    <UsageChart
      height={height}
      points={usage.buckets.map((bucket) => ({
        label: bucketLabel(bucket.start, usage.bucketMinutes),
        requests: bucket.requests - bucket.errors,
        errors: bucket.errors,
        p95LatencyMs: bucket.p95LatencyMs,
      }))}
    />
  );
}

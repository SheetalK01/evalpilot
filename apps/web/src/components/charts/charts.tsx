'use client';

import type { ReactNode } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMs, formatPercent, formatUsd } from '@/lib/format';

const axis = {
  stroke: 'var(--line)',
  tickLine: false,
  tick: { fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-mono)' },
} as const;

function ChartTooltip({
  active,
  payload,
  label,
  format,
}: Partial<TooltipContentProps<number, string>> & { format: (name: string, value: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="panel px-3 py-2 text-xs">
      <div className="label-mono mb-1.5">{String(label)}</div>
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="num flex items-center gap-2">
          <span className="size-2 rounded-[1px]" style={{ background: entry.color }} />
          <span className="text-muted">{entry.name}</span>
          <span className="ml-auto pl-4 text-text">{format(String(entry.dataKey), Number(entry.value))}</span>
        </div>
      ))}
    </div>
  );
}

function ChartFrame({ height, children, label }: { height: number; children: ReactNode; label: string }) {
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export interface PassRatePoint {
  label: string;
  passRate: number;
}

/** Pass rate per run, with the threshold as a dashed reference line. */
export function PassRateChart({
  points,
  threshold = 0.9,
  height = 220,
}: {
  points: PassRatePoint[];
  threshold?: number;
  height?: number;
}) {
  const data = points.map((point) => ({ ...point, pct: Math.round(point.passRate * 1000) / 10 }));
  return (
    <ChartFrame height={height} label={`Pass rate over the last ${points.length} runs`}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} accessibilityLayer={false}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="label" {...axis} minTickGap={24} />
        <YAxis domain={[0, 100]} ticks={[0, 50, 100]} {...axis} unit="%" />
        <ReferenceLine y={threshold * 100} stroke="var(--warn)" strokeDasharray="4 4" strokeOpacity={0.7} />
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)' }}
          trigger="hover"
          wrapperStyle={{ pointerEvents: 'none' }}
          content={<ChartTooltip format={(_k, v) => formatPercent(v / 100)} />}
        />
        <Line
          type="linear"
          dataKey="pct"
          name="Pass rate"
          stroke="var(--text)"
          strokeWidth={1.5}
          isAnimationActive={false}
          dot={(props: { cx?: number; cy?: number; payload?: { passRate: number }; index?: number }) => (
            <circle
              key={props.index}
              cx={props.cx}
              cy={props.cy}
              r={3.5}
              fill={(props.payload?.passRate ?? 0) >= threshold ? 'var(--pass)' : 'var(--fail)'}
              stroke="var(--panel)"
              strokeWidth={1.5}
            />
          )}
        />
      </LineChart>
    </ChartFrame>
  );
}

export interface CostLatencyPoint {
  label: string;
  costUsd: number;
  p95LatencyMs: number | null;
}

/** Daily cost (area, left axis) and p95 latency (thin line, right axis), both clipped to the plot. */
export function CostLatencyChart({ points, height = 220 }: { points: CostLatencyPoint[]; height?: number }) {
  return (
    <div>
      <div className="label-mono mb-2 flex items-center gap-4 text-[11px]" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-[1px] bg-muted/40" /> Cost · left
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-px w-3 bg-text" /> p95 latency · right
        </span>
      </div>
      <ChartFrame height={height} label="Cost and p95 latency per day">
        <ComposedChart
          data={points}
          margin={{ top: 12, right: 4, bottom: 0, left: 4 }}
          accessibilityLayer={false}
        >
          <defs>
            <linearGradient id="cost-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--muted)" stopOpacity={0.3} />
              <stop offset="1" stopColor="var(--muted)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="label" {...axis} minTickGap={24} />
          <YAxis
            yAxisId="cost"
            {...axis}
            domain={[0, 'auto']}
            tickCount={4}
            tickFormatter={(v: number) => formatUsd(v)}
            width={56}
          />
          <YAxis
            yAxisId="latency"
            orientation="right"
            {...axis}
            domain={[0, 'auto']}
            tickCount={4}
            tickFormatter={(v: number) => `${Math.round(v)}ms`}
            width={52}
          />
          <Tooltip
            cursor={{ stroke: 'var(--line-strong)' }}
            wrapperStyle={{ pointerEvents: 'none' }}
            content={<ChartTooltip format={(k, v) => (k === 'costUsd' ? formatUsd(v) : formatMs(v))} />}
          />
          <Area
            yAxisId="cost"
            type="monotoneX"
            dataKey="costUsd"
            name="Cost"
            stroke="var(--muted)"
            fill="url(#cost-fill)"
            strokeWidth={1.25}
            baseValue={0}
            isAnimationActive={false}
          />
          <Line
            yAxisId="latency"
            type="linear"
            dataKey="p95LatencyMs"
            name="p95 latency"
            stroke="var(--text)"
            strokeWidth={1.25}
            dot={false}
            activeDot={{ r: 3, stroke: 'var(--panel)', strokeWidth: 1.5 }}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartFrame>
    </div>
  );
}

export interface UsagePoint {
  label: string;
  requests: number;
  errors: number;
  p95LatencyMs: number | null;
}

/** Requests (grey) and errors (red) per bucket, p95 latency as a line. */
export function UsageChart({ points, height = 200 }: { points: UsagePoint[]; height?: number }) {
  return (
    <ChartFrame height={height} label="Requests, errors and p95 latency over time">
      <ComposedChart
        data={points}
        margin={{ top: 8, right: 4, bottom: 0, left: -18 }}
        barGap={1}
        accessibilityLayer={false}
      >
        <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="label" {...axis} minTickGap={28} />
        <YAxis yAxisId="count" {...axis} allowDecimals={false} />
        <YAxis yAxisId="latency" orientation="right" {...axis} width={44} />
        <Tooltip
          cursor={{ fill: 'var(--panel-2)' }}
          content={<ChartTooltip format={(k, v) => (k === 'p95LatencyMs' ? formatMs(v) : String(v))} />}
        />
        <Bar
          yAxisId="count"
          dataKey="requests"
          name="Requests"
          fill="var(--line-strong)"
          isAnimationActive={false}
        />
        <Bar yAxisId="count" dataKey="errors" name="Errors" fill="var(--fail)" isAnimationActive={false} />
        <Line
          yAxisId="latency"
          type="monotone"
          dataKey="p95LatencyMs"
          name="p95 latency"
          stroke="var(--text)"
          strokeWidth={1.25}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartFrame>
  );
}

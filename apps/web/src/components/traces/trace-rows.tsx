'use client';

import type { TraceListItemResponse } from '@evalpilot/shared';
import { cn } from '@/lib/cn';
import { formatClock, formatCount, formatUsd } from '@/lib/format';
import { LatencyBar } from '../instruments/latency-bar';
import { Led } from '../instruments/status';

/**
 * The "black box" feed: one monospace row per trace, like a flight recorder log. New rows slide
 * in at the top. Latency bars are scaled to `latencyRef` (the p95), so slow calls stand out.
 */
export function TraceRows({
  traces,
  onSelect,
  latencyRef,
  freshIds,
}: {
  traces: TraceListItemResponse[];
  onSelect: (id: string) => void;
  latencyRef: number;
  freshIds?: Set<string>;
}) {
  return (
    <div role="table" aria-label="Traces" className="num text-[12.5px]">
      <div
        role="row"
        className="label-mono hidden grid-cols-[76px_14px_minmax(0,1.1fr)_minmax(0,1.6fr)_180px_64px_72px] gap-3 border-b border-line px-4 py-2.5 lg:grid"
      >
        <span role="columnheader">UTC</span>
        <span role="columnheader" aria-label="Status" />
        <span role="columnheader">NAME · MODEL</span>
        <span role="columnheader">INPUT</span>
        <span role="columnheader">LATENCY</span>
        <span role="columnheader" className="text-right">
          TOKENS
        </span>
        <span role="columnheader" className="text-right">
          COST
        </span>
      </div>
      <div role="rowgroup" className="divide-y divide-line">
        {traces.map((trace) => (
          <button
            key={trace.id}
            type="button"
            role="row"
            data-testid="trace-row"
            onClick={() => onSelect(trace.id)}
            className={cn(
              'grid w-full grid-cols-[64px_14px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-left transition-colors hover:bg-panel-2 focus-visible:bg-panel-2 lg:grid-cols-[76px_14px_minmax(0,1.1fr)_minmax(0,1.6fr)_180px_64px_72px]',
              freshIds?.has(trace.id) && 'animate-row-in bg-[color-mix(in_oklab,var(--info)_6%,transparent)]',
            )}
          >
            <span role="cell" className="text-muted">
              {formatClock(trace.startedAt)}
            </span>
            <span role="cell" aria-label={trace.status}>
              <Led tone={trace.status === 'OK' ? 'pass' : 'fail'} />
            </span>
            <span role="cell" className="min-w-0">
              <span className="block truncate text-text">{trace.name}</span>
              <span className="block truncate text-[11px] text-muted">{trace.model ?? 'unknown model'}</span>
            </span>
            <span
              role="cell"
              className={cn(
                'col-span-4 truncate text-muted lg:col-span-1',
                trace.status === 'ERROR' && 'text-fail',
              )}
            >
              {trace.status === 'ERROR' ? trace.error : trace.inputPreview}
            </span>
            <span role="cell" className="col-span-2 lg:col-span-1">
              <LatencyBar ms={trace.latencyMs} max={latencyRef} />
            </span>
            <span role="cell" className="text-right text-muted lg:text-text">
              {formatCount(trace.inputTokens + trace.outputTokens)}
            </span>
            <span role="cell" className="text-right text-muted">
              {formatUsd(trace.estCostUsd)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

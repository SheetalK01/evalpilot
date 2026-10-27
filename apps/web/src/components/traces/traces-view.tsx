'use client';

import type { TraceListItemResponse, UsageRange } from '@evalpilot/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { keys, useProject, useTraces, useUsage } from '@/lib/queries';
import { useRealtimeRoom } from '@/lib/realtime';
import { Panel } from '../instruments/panel';
import { EmptyState, ErrorState, Scan, ScanRows } from '../instruments/states';
import { Led } from '../instruments/status';
import { useCurrentProject } from '../shell/deck-context';
import { PageHeader } from '../shell/page-header';
import { Input } from '../ui/field';
import { Kbd } from '../ui/misc';
import { TraceInspector } from './trace-inspector';
import { TraceRows } from './trace-rows';
import { RangeSwitch, UsageCharts, UsageReadouts } from './usage';

const STATUS_FILTERS = [
  ['', 'ALL'],
  ['OK', 'OK'],
  ['ERROR', 'ERRORS'],
] as const;

/** Live traces feed with search, filters and the trace inspector. `compact` is the project tab. */
export function TracesFeed({ projectId, compact = false }: { projectId: string; compact?: boolean }) {
  const [status, setStatus] = useState<'' | 'OK' | 'ERROR'>('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const traces = useTraces(projectId, status, debounced);
  const usage = useUsage(projectId, '24h');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (compact) return undefined;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === '/' && target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compact]);

  const live = useRealtimeRoom(`project:${projectId}`, {
    'trace.created': ({ trace }) => {
      const matches =
        (!status || trace.status === status) &&
        (!debounced ||
          `${trace.name} ${trace.model ?? ''} ${trace.inputPreview ?? ''}`
            .toLowerCase()
            .includes(debounced.toLowerCase()));
      if (!matches) return;
      client.setQueryData<TraceListItemResponse[]>(keys.traces(projectId, status, debounced), (list) =>
        list ? [trace, ...list.filter((t) => t.id !== trace.id)].slice(0, 100) : list,
      );
      setFresh((previous) => new Set(previous).add(trace.id));
      setTimeout(
        () =>
          setFresh((previous) => {
            const next = new Set(previous);
            next.delete(trace.id);
            return next;
          }),
        2500,
      );
    },
  });

  const latencyRef = Math.max(usage.data?.totals.p95LatencyMs ?? 0, 400);
  const rows = compact ? traces.data?.slice(0, 8) : traces.data;

  return (
    <Panel
      title={
        <div className="flex items-center gap-3">
          <h2 className="label-mono">BLACK BOX · LIVE TRACES</h2>
          <Led
            tone={live === 'live' ? 'info' : 'muted'}
            pulse={live === 'live'}
            label={live === 'live' ? 'LIVE' : live === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
          />
        </div>
      }
      action={
        compact ? (
          <Link
            href={`/app/projects/${projectId}/traces`}
            className="label-mono text-signal hover:underline"
            data-testid="open-traces"
          >
            OPEN FLIGHT RECORDER →
          </Link>
        ) : null
      }
      bodyClassName="p-0"
    >
      {compact ? null : (
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
              strokeWidth={1.5}
            />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, model or input"
              className="pr-10 pl-9"
              aria-label="Search traces"
              data-testid="trace-search"
            />
            <Kbd className="absolute top-1/2 right-2.5 -translate-y-1/2">/</Kbd>
          </div>
          <div
            role="radiogroup"
            aria-label="Status"
            className="inline-flex rounded-sm border border-line p-0.5"
          >
            {STATUS_FILTERS.map(([value, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={status === value}
                data-testid={`trace-filter-${label.toLowerCase()}`}
                onClick={() => setStatus(value)}
                className={cn(
                  'label-mono rounded-xs px-3 py-1.5 transition-colors',
                  status === value ? 'bg-panel-2 text-text' : 'hover:text-text',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {traces.isLoading ? (
        <ScanRows className="p-4" rows={compact ? 4 : 10} />
      ) : traces.error ? (
        <ErrorState className="m-4" error={traces.error} onRetry={() => void traces.refetch()} />
      ) : rows && rows.length > 0 ? (
        <TraceRows traces={rows} onSelect={setSelected} latencyRef={latencyRef} freshIds={fresh} />
      ) : (
        <EmptyState
          title={debounced || status ? 'No matching traces' : 'No traces yet'}
          text={
            debounced || status
              ? 'Try another search or filter.'
              : 'Add the SDK to your app with a project API key, then traces stream in here live.'
          }
          className="py-10"
        />
      )}
      <TraceInspector traceId={selected} onClose={() => setSelected(null)} />
    </Panel>
  );
}

export function TracesView({ projectId }: { projectId: string }) {
  useCurrentProject(projectId);
  const project = useProject(projectId);
  const [range, setRange] = useState<UsageRange>('24h');
  const usage = useUsage(projectId, range);
  const title = useMemo(() => project.data?.name ?? '…', [project.data]);

  return (
    <div className="space-y-6" data-testid="traces-page">
      <PageHeader
        eyebrow={
          <>
            <Link href={`/app/projects/${projectId}`} className="hover:text-text">
              {title.toUpperCase()}
            </Link>
            <span>/</span>
            <span>FLIGHT RECORDER</span>
          </>
        }
        title="Traces"
        description="Every production call your app sends through the SDK: latency, tokens, cost and errors."
        actions={<RangeSwitch value={range} onChange={setRange} />}
      />
      <Panel title={`USAGE · ${range.toUpperCase()}`} bodyClassName="p-0">
        {usage.isLoading ? (
          <div className="grid grid-cols-2 gap-4 p-4 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Scan key={i} className="h-16" />
            ))}
          </div>
        ) : usage.error ? (
          <ErrorState className="m-4" error={usage.error} onRetry={() => void usage.refetch()} />
        ) : usage.data ? (
          <>
            <UsageReadouts usage={usage.data} />
            <div className="border-t border-line p-4">
              <UsageCharts usage={usage.data} />
            </div>
          </>
        ) : null}
      </Panel>
      <TracesFeed projectId={projectId} />
    </div>
  );
}

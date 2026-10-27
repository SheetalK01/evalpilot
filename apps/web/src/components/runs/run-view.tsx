'use client';

import { FINAL_RUN_STATUSES, type RunResponse, type TestResultResponse } from '@evalpilot/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, GitCompareArrows, Play, Square, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { formatClock, formatCount, formatMs, formatPercent, formatUsd, shortId } from '@/lib/format';
import { keys, useCancelRun, useRun, useRunResults, useStartRun, useSuiteRuns } from '@/lib/queries';
import { useRealtimeRoom } from '@/lib/realtime';
import { FlightStrip, type StripStatus } from '../instruments/flight-strip';
import { LatencyBar } from '../instruments/latency-bar';
import { Panel, Readout } from '../instruments/panel';
import { RollingNumber } from '../instruments/rolling-number';
import { EmptyState, ErrorState, Scan, ScanRows } from '../instruments/states';
import { Led, StatusTag, Tag } from '../instruments/status';
import { useCurrentProject } from '../shell/deck-context';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { Switch } from '../ui/misc';
import { RunDiff } from './run-diff';

const p95 = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? null;
};

function ResultRow({
  result,
  open,
  onToggle,
  latencyRef,
}: {
  result: TestResultResponse;
  open: boolean;
  onToggle: () => void;
  latencyRef: number;
}) {
  const passedChecks = result.checkResults.filter((check) => check.passed).length;
  return (
    <li data-testid="result-row" className="animate-row-in">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[28px_64px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-panel-2 sm:grid-cols-[28px_72px_minmax(0,1fr)_200px_72px_20px]"
      >
        <span className="num text-[12px] text-muted">{String(result.position + 1).padStart(2, '0')}</span>
        <span data-testid="result-status">
          <StatusTag status={result.status} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm text-text">{result.caseName}</span>
          {result.error ? (
            <span className="num block truncate text-[12px] text-warn">{result.error}</span>
          ) : null}
        </span>
        <span className="col-span-4 col-start-2 sm:col-span-1 sm:col-start-auto">
          <LatencyBar ms={result.latencyMs} max={latencyRef} />
        </span>
        <span className="num hidden text-right text-[12px] text-muted sm:block">
          {passedChecks}/{result.checkResults.length} checks
        </span>
        <ChevronDown
          className={cn('hidden size-4 text-muted transition-transform sm:block', open && 'rotate-180')}
          strokeWidth={1.5}
        />
      </button>
      {open ? (
        <div
          className="grid gap-4 border-t border-line bg-bg/60 px-4 py-4 lg:grid-cols-2"
          data-testid="result-detail"
        >
          <section className="min-w-0 space-y-2">
            <h3 className="label-mono">OUTPUT</h3>
            <pre className="num max-h-72 overflow-auto rounded-sm border border-line bg-panel p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap text-text">
              {result.output ?? '— no answer —'}
            </pre>
          </section>
          <section className="min-w-0 space-y-2">
            <h3 className="label-mono">CHECKS</h3>
            <ul className="space-y-1.5">
              {result.checkResults.map((check, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2.5 rounded-sm border border-line bg-panel px-3 py-2 text-[13px]"
                  data-testid="check-result"
                >
                  {check.passed ? (
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-pass"
                      strokeWidth={1.75}
                      aria-label="Passed"
                    />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0 text-fail" strokeWidth={1.75} aria-label="Failed" />
                  )}
                  <span className="min-w-0">
                    <span className="num mr-2 text-[12px] text-muted">{check.type}</span>
                    {check.mode ? <Tag className="mr-2 h-[18px]">{check.mode}</Tag> : null}
                    <span className="break-words text-text">{check.message}</span>
                  </span>
                </li>
              ))}
              {result.checkResults.length === 0 ? (
                <li className="text-[13px] text-muted">Not evaluated: the target did not answer.</li>
              ) : null}
            </ul>
            <p className="num text-[12px] text-muted">
              {formatCount(result.tokens)} tokens · {formatUsd(result.estCostUsd)}
              {result.judgeScore !== null ? ` · judge ${result.judgeScore}/10` : ''}
            </p>
          </section>
        </div>
      ) : null}
    </li>
  );
}

export function RunView({ runId }: { runId: string }) {
  const client = useQueryClient();
  const router = useRouter();
  const run = useRun(runId);
  const results = useRunResults(runId);
  useCurrentProject(run.data?.projectId);
  const history = useSuiteRuns(run.data?.suiteId ?? '');
  const cancel = useCancelRun();
  const startRun = useStartRun();
  const [failedOnly, setFailedOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);

  const live = run.data ? !FINAL_RUN_STATUSES.includes(run.data.status) : false;
  const socket = useRealtimeRoom(live ? `run:${runId}` : null, {
    'result.created': ({ result }) => {
      client.setQueryData<TestResultResponse[]>(keys.results(runId), (list = []) =>
        [...list.filter((r) => r.id !== result.id), result].sort((a, b) => a.position - b.position),
      );
      client.setQueryData<RunResponse>(keys.run(runId), (current) =>
        current && current.status === 'QUEUED' ? { ...current, status: 'RUNNING' } : current,
      );
    },
    'run.completed': ({ run: finished }) => {
      client.setQueryData(keys.run(runId), finished);
      void client.invalidateQueries({ queryKey: keys.results(runId) });
      void client.invalidateQueries({ queryKey: keys.runs(finished.suiteId) });
      void client.invalidateQueries({ queryKey: keys.dashboard });
    },
  });

  // Fallback: if the socket is down while the run is live, poll every 2 s instead.
  const polling = live && socket === 'offline';
  const { refetch: refetchRun } = run;
  const { refetch: refetchResults } = results;
  useEffect(() => {
    if (!polling) return undefined;
    const timer = setInterval(() => {
      void refetchRun();
      void refetchResults();
    }, 2000);
    return () => clearInterval(timer);
  }, [polling, refetchRun, refetchResults]);

  const list = useMemo(() => results.data ?? [], [results.data]);
  const previous = useMemo(() => {
    const runs = history.data ?? [];
    const index = runs.findIndex((r) => r.id === runId);
    return index >= 0 ? (runs[index + 1] ?? null) : null;
  }, [history.data, runId]);

  if (run.isLoading) {
    return (
      <div className="space-y-6">
        <Scan className="h-10 w-80" />
        <Scan className="h-28" />
        <Scan className="h-16" />
        <ScanRows rows={6} />
      </div>
    );
  }
  if (run.error || !run.data) return <ErrorState error={run.error} onRetry={() => void run.refetch()} />;
  const data = run.data;

  const done = list.length;
  const total = Math.max(data.total, done);
  const statuses: StripStatus[] = Array.from(
    { length: total },
    (_, position) => list.find((r) => r.position === position)?.status ?? null,
  );
  const passed = list.filter((r) => r.status === 'PASSED').length;
  const passRate = data.passRate ?? (done ? passed / done : null);
  const latencies = list.map((r) => r.latencyMs).filter((ms): ms is number => ms !== null);
  const p95Latency = p95(latencies);
  const tokens = list.reduce((sum, r) => sum + r.tokens, 0);
  const cost = list.reduce((sum, r) => sum + r.estCostUsd, 0);
  const shown = failedOnly ? list.filter((r) => r.status !== 'PASSED') : list;
  const progress = total ? Math.round((done / total) * 100) : 0;
  const verdictTone = data.status === 'PASSED' ? 'pass' : data.status === 'FAILED' ? 'fail' : undefined;

  return (
    <div className="space-y-6" data-testid="run-page">
      <PageHeader
        eyebrow={
          <>
            <Link href={`/app/suites/${data.suiteId}`} className="hover:text-text">
              {data.suiteName.toUpperCase()}
            </Link>
            <span>/</span>
            <span>RUN {shortId(data.id)}</span>
            <span>·</span>
            <span>{data.trigger}</span>
            {data.commitSha ? <span className="text-text">{data.commitSha.slice(0, 7)}</span> : null}
          </>
        }
        title={
          <span className="flex items-center gap-3">
            {live
              ? 'Run in flight'
              : data.status === 'PASSED'
                ? 'Run passed'
                : data.status === 'FAILED'
                  ? 'Run failed'
                  : data.status === 'CANCELLED'
                    ? 'Run cancelled'
                    : 'Run error'}
            <span data-testid="run-status">
              <StatusTag status={data.status} />
            </span>
          </span>
        }
        actions={
          live ? (
            <Button
              variant="danger"
              disabled={cancel.isPending}
              data-testid="cancel-run"
              onClick={() =>
                cancel.mutate(runId, {
                  onSuccess: () => toast.success('Cancelling: the run stops before its next case'),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              <Square /> Cancel run
            </Button>
          ) : (
            <>
              {previous ? (
                <Button
                  onClick={() => setComparing((c) => !c)}
                  aria-pressed={comparing}
                  data-testid="compare-button"
                >
                  <GitCompareArrows /> {comparing ? 'Hide comparison' : 'Compare with previous'}
                </Button>
              ) : null}
              <Button
                variant="primary"
                disabled={startRun.isPending}
                onClick={() =>
                  startRun.mutate(data.suiteId, {
                    onSuccess: ({ runId: id }) => router.push(`/app/runs/${id}`),
                    onError: (e) => toast.error(e.message),
                  })
                }
                data-testid="run-again"
              >
                <Play /> Run again
              </Button>
            </>
          )
        }
      />

      {data.error ? <ErrorState error={new Error(data.error)} /> : null}

      <section
        aria-label="Run readings"
        className="panel crosshair grid grid-cols-2 gap-px overflow-hidden bg-line lg:grid-cols-5 [&>*]:bg-panel [&>*]:p-5 max-lg:[&>*:last-child]:col-span-2"
      >
        <Readout
          label="PASS RATE"
          testId="readout-pass-rate"
          value={passRate === null ? '—' : <RollingNumber value={formatPercent(passRate)} />}
          tone={verdictTone ?? (live ? 'info' : undefined)}
          sub={`threshold ${formatPercent(data.passThreshold)}`}
        />
        <Readout
          label="CASES"
          value={<RollingNumber value={`${done}/${total}`} />}
          sub={`${passed} passed · ${done - passed} failed`}
        />
        <Readout
          label="LATENCY P95"
          value={<RollingNumber value={formatMs(p95Latency)} />}
          sub={`avg ${formatMs(latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null)}`}
        />
        <Readout label="TOKENS" value={<RollingNumber value={formatCount(tokens)} />} sub="target + judge" />
        <Readout
          label="EST. COST"
          value={<RollingNumber value={formatUsd(cost)} />}
          sub={data.startedAt ? `started ${formatClock(data.startedAt)} UTC` : 'queued'}
        />
      </section>

      <Panel
        title={
          <div className="flex items-center gap-3">
            <h2 className="label-mono">FLIGHT STRIP</h2>
            {live ? <Led tone="info" pulse label={socket === 'live' ? 'STREAMING' : 'POLLING'} /> : null}
          </div>
        }
        action={<span className="num text-[12px] text-muted">{progress}%</span>}
      >
        <FlightStrip statuses={statuses} live={live} />
        <div
          className="mt-4 h-1 overflow-hidden rounded-[1px] bg-line"
          role="progressbar"
          aria-label="Run progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          data-testid="run-progress"
        >
          <div
            className={cn(
              'h-full transition-[width] duration-300 ease-out',
              live ? 'bg-info' : verdictTone === 'fail' ? 'bg-fail' : 'bg-pass',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="sr-only" aria-live="polite">
          {done} of {total} cases done
        </p>
      </Panel>

      {comparing && previous ? <RunDiff headId={runId} baseId={previous.id} /> : null}

      <Panel
        title={`RESULTS · ${done}/${total}`}
        bodyClassName="p-0"
        action={
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
            <Switch
              checked={failedOnly}
              onCheckedChange={setFailedOnly}
              data-testid="filter-failed"
              aria-label="Show failed only"
            />
            Failed only
          </label>
        }
      >
        {results.isLoading ? (
          <ScanRows className="p-4" rows={6} />
        ) : shown.length === 0 ? (
          <EmptyState
            title={failedOnly && done > 0 ? 'Nothing failed' : 'Waiting for results'}
            text={
              failedOnly && done > 0
                ? 'Every finished case passed.'
                : 'Results appear here the moment each case finishes.'
            }
            className="py-10"
          />
        ) : (
          <ol className="divide-y divide-line">
            {shown.map((result) => (
              <ResultRow
                key={result.id}
                result={result}
                latencyRef={Math.max(p95Latency ?? 0, 400)}
                open={openId === result.id}
                onToggle={() => setOpenId((id) => (id === result.id ? null : result.id))}
              />
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useDashboard, useMe } from '@/lib/queries';
import { formatCount, formatPercent, formatUsd } from '@/lib/format';
import { CostLatencyChart, PassRateChart } from '../charts/charts';
import { Panel, Readout } from '../instruments/panel';
import { RiskGauge } from '../instruments/risk-gauge';
import { RollingNumber } from '../instruments/rolling-number';
import { EmptyState, ErrorState, Scan, ScanRows } from '../instruments/states';
import { riskTone } from '../instruments/status';
import { RunRows } from '../runs/run-rows';
import { useDeck } from '../shell/deck-context';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <Scan className="h-9 w-56" />
      <div className="panel grid grid-cols-2 gap-px lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 p-5">
            <Scan className="h-3 w-20" />
            <Scan className="h-8 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Scan className="h-72 lg:col-span-2" />
        <Scan className="h-72" />
      </div>
    </div>
  );
}

export function Dashboard() {
  const dashboard = useDashboard();
  const me = useMe();
  const { setNewProjectOpen } = useDeck();
  const newProject = (
    <Button variant="primary" onClick={() => setNewProjectOpen(true)} data-testid="new-project-button">
      <Plus /> New project
    </Button>
  );

  if (dashboard.isLoading) return <DashboardSkeleton />;
  if (dashboard.error) return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  const data = dashboard.data;
  if (!data) return null;

  const firstName = me.data?.name.split(/\s+/)[0] ?? 'pilot';
  if (data.counts.projects === 0) {
    return (
      <div className="space-y-6" data-testid="dashboard">
        <PageHeader
          eyebrow="FLIGHT DECK"
          title={`Welcome aboard, ${firstName}`}
          description="Create a project for your AI app, connect it, and run your first suite."
        />
        <Panel>
          <EmptyState
            title="No projects yet"
            text="A project holds one AI app: its targets, test suites, red-team runs and traces."
            action={newProject}
            testId="dashboard-empty"
          />
        </Panel>
      </div>
    );
  }

  const trend = data.passRateTrend;
  const latest = trend.at(-1);
  const previous = trend.at(-2);
  const delta = latest && previous ? latest.passRate - previous.passRate : null;
  const tracesCost = data.costTrend.reduce((sum, day) => sum + day.tracesCostUsd + day.runsCostUsd, 0);
  const risk = data.latestRedteam;
  const riskScore = risk?.riskScore ?? null;

  return (
    <div className="space-y-6" data-testid="dashboard">
      <PageHeader
        eyebrow={
          <>
            FLIGHT DECK ·{' '}
            {new Date()
              .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
              .toUpperCase()}
          </>
        }
        title={`Good to see you, ${firstName}`}
        actions={newProject}
      />

      <section
        aria-label="Key readings"
        className="panel crosshair grid grid-cols-2 lg:grid-cols-4 [&>*]:p-5 [&>*:nth-child(2n)]:border-l [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+2)]:border-l lg:[&>*:nth-child(n+3)]:border-t-0"
      >
        <Readout
          label="PASS RATE · LATEST"
          testId="readout-pass-rate"
          value={latest ? <RollingNumber value={formatPercent(latest.passRate)} /> : '—'}
          tone={latest ? (latest.passRate >= 0.9 ? 'pass' : 'fail') : undefined}
          sub={
            delta === null
              ? latest?.suiteName
              : delta === 0
                ? 'Same as the previous run'
                : `${delta > 0 ? '▲' : '▼'} ${formatPercent(Math.abs(delta))} vs previous run`
          }
        />
        <Readout
          label="RISK SCORE"
          testId="readout-risk"
          value={riskScore === null ? '—' : <RollingNumber value={String(riskScore)} />}
          tone={riskScore === null ? undefined : (riskTone(riskScore) as 'pass' | 'warn' | 'fail')}
          sub={
            risk
              ? `${risk.riskLevel ?? ''} · ${risk.vulnerable}/${risk.total} attacks landed`
              : 'No red-team run yet'
          }
        />
        <Readout
          label="TRACES · 24H"
          testId="readout-traces"
          value={<RollingNumber value={formatCount(data.counts.traces24h)} />}
          sub={`${data.counts.runs} ${data.counts.runs === 1 ? 'run' : 'runs'} · ${data.counts.suites} ${data.counts.suites === 1 ? 'suite' : 'suites'}`}
        />
        <Readout
          label="EST. COST · 14D"
          testId="readout-cost"
          value={<RollingNumber value={formatUsd(tracesCost)} />}
          sub="Test runs + production traces"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="PASS RATE · LAST RUNS"
          className="lg:col-span-2"
          action={<span className="num text-[11px] text-warn">--- THRESHOLD 90%</span>}
        >
          {trend.length > 1 ? (
            <PassRateChart
              points={trend.map((point) => ({ label: shortDate(point.createdAt), passRate: point.passRate }))}
            />
          ) : (
            <EmptyState
              title="Not enough runs yet"
              text="Run a suite twice to see the trend."
              className="py-8"
            />
          )}
        </Panel>
        <Panel
          title="RED-TEAM RISK"
          action={
            risk ? (
              <Link className="label-mono text-signal hover:underline" href={`/app/redteam/${risk.id}`}>
                REPORT →
              </Link>
            ) : null
          }
        >
          <div className="flex h-full flex-col justify-center py-4">
            <RiskGauge score={risk?.riskScore ?? null} level={risk?.riskLevel} />
            {risk ? (
              <p className="num mt-4 text-center text-[12px] text-muted">
                {risk.targetName} · {shortDate(risk.createdAt)}
              </p>
            ) : (
              <p className="mt-4 text-center text-sm text-muted">Start a red-team run from a project.</p>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="RECENT RUNS" className="lg:col-span-2" bodyClassName="p-0">
          {data.recentRuns.length > 0 ? (
            <RunRows runs={data.recentRuns} />
          ) : (
            <EmptyState title="No runs yet" text="Open a suite and press Run." className="py-8" />
          )}
        </Panel>
        <Panel title="COST & P95 LATENCY · 14D">
          {data.costTrend.some((d) => d.tracesCostUsd + d.runsCostUsd > 0) ? (
            <CostLatencyChart
              height={300}
              points={data.costTrend.map((day) => ({
                label: day.date.slice(5),
                costUsd: day.tracesCostUsd + day.runsCostUsd,
                p95LatencyMs: day.p95LatencyMs,
              }))}
            />
          ) : (
            <ScanRows rows={0} />
          )}
        </Panel>
      </div>
    </div>
  );
}

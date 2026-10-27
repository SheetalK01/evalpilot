'use client';

import {
  ATTACK_CATEGORY_LABELS,
  type RedteamFindingResponse,
  type RedteamReportResponse,
} from '@evalpilot/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Lightbulb, Radar } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { formatClock, shortId } from '@/lib/format';
import { keys, useRedteamReport, useStartRedteam } from '@/lib/queries';
import { useRealtimeRoom } from '@/lib/realtime';
import { Panel } from '../instruments/panel';
import { RiskGauge } from '../instruments/risk-gauge';
import { RollingNumber } from '../instruments/rolling-number';
import { EmptyState, ErrorState, Scan, ScanRows } from '../instruments/states';
import { Led, SeverityTag, StatusTag, Tag } from '../instruments/status';
import { ThreatRadar } from '../instruments/threat-radar';
import { useCurrentProject } from '../shell/deck-context';
import { PageHeader } from '../shell/page-header';
import { Button } from '../ui/button';
import { Switch } from '../ui/misc';

const LIVE = new Set(['QUEUED', 'RUNNING']);

function FindingRow({
  finding,
  open,
  onToggle,
}: {
  finding: RedteamFindingResponse;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li data-testid="finding-row" data-vulnerable={finding.vulnerable} className="animate-row-in">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="num grid w-full grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left text-[12.5px] transition-colors hover:bg-panel-2 sm:grid-cols-[96px_72px_170px_minmax(0,1fr)_96px_16px]"
      >
        <span>
          <SeverityTag severity={finding.severity} />
        </span>
        <span className="hidden text-muted sm:block">{formatClock(finding.createdAt)}</span>
        <span className="hidden truncate text-muted sm:block">{finding.category}</span>
        <span className={cn('truncate', finding.vulnerable ? 'text-text' : 'text-muted')}>
          {finding.attackName}
        </span>
        <span className="justify-self-end">
          {finding.vulnerable ? <Tag tone="fail">LANDED</Tag> : <Tag tone="pass">BLOCKED</Tag>}
        </span>
        <ChevronDown
          className={cn('hidden size-4 text-muted transition-transform sm:block', open && 'rotate-180')}
          strokeWidth={1.5}
        />
      </button>
      {open ? (
        <div
          className="grid gap-4 border-t border-line bg-bg/60 px-4 py-4 lg:grid-cols-2"
          data-testid="finding-detail"
        >
          <section className="min-w-0 space-y-2">
            <h3 className="label-mono">ATTACK · {ATTACK_CATEGORY_LABELS[finding.category].toUpperCase()}</h3>
            <pre className="num rounded-sm border border-line bg-panel p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap text-text">
              {finding.prompt}
            </pre>
            <h3 className="label-mono pt-2">ANSWER</h3>
            <pre className="num max-h-60 overflow-auto rounded-sm border border-line bg-panel p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap text-text">
              {finding.output ?? '— no answer —'}
            </pre>
          </section>
          <section className="min-w-0 space-y-3">
            <div className="space-y-2">
              <h3 className="label-mono">EVIDENCE</h3>
              <p
                className={cn(
                  'rounded-sm border px-3 py-2 text-[13px]',
                  finding.vulnerable
                    ? 'border-[color-mix(in_oklab,var(--fail)_40%,transparent)] text-fail'
                    : 'border-line text-muted',
                )}
              >
                {finding.evidence ?? 'The attack did not work: no detection rule fired.'}
              </p>
            </div>
            <div className="panel space-y-1.5 p-3">
              <h3 className="label-mono flex items-center gap-2 text-signal">
                <Lightbulb className="size-3.5" strokeWidth={1.5} /> HOW TO FIX
              </h3>
              <p className="text-[13px] text-text">{finding.fixTip}</p>
            </div>
          </section>
        </div>
      ) : null}
    </li>
  );
}

export function RedteamReport({ redteamId }: { redteamId: string }) {
  const client = useQueryClient();
  const router = useRouter();
  const report = useRedteamReport(redteamId);
  useCurrentProject(report.data?.projectId);
  const start = useStartRedteam(report.data?.projectId ?? '');
  const [openId, setOpenId] = useState<string | null>(null);
  const [landedOnly, setLandedOnly] = useState(false);
  const live = report.data ? LIVE.has(report.data.status) : false;

  useRealtimeRoom(live ? `redteam:${redteamId}` : null, {
    'redteam.finding': ({ finding }) =>
      client.setQueryData<RedteamReportResponse>(keys.redteam(redteamId), (current) =>
        current
          ? {
              ...current,
              status: 'RUNNING',
              vulnerable: current.vulnerable + (finding.vulnerable ? 1 : 0),
              findings: [...current.findings.filter((f) => f.id !== finding.id), finding].sort(
                (a, b) => Number(b.vulnerable) - Number(a.vulnerable),
              ),
              categories: current.categories.map((c) =>
                c.category === finding.category
                  ? { ...c, total: c.total + 1, vulnerable: c.vulnerable + (finding.vulnerable ? 1 : 0) }
                  : c,
              ),
            }
          : current,
      ),
    'redteam.completed': () => void client.invalidateQueries({ queryKey: keys.redteam(redteamId) }),
  });

  if (report.isLoading) {
    return (
      <div className="space-y-6">
        <Scan className="h-10 w-80" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Scan className="h-80" />
          <Scan className="h-80" />
        </div>
        <ScanRows rows={6} />
      </div>
    );
  }
  if (report.error || !report.data)
    return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;
  const data = report.data;
  const done = data.findings.length;
  const shown = landedOnly ? data.findings.filter((f) => f.vulnerable) : data.findings;
  const severities = (severity: string) =>
    data.findings.filter((f) => f.vulnerable && f.severity === severity).length;
  const radar = data.categories.map((c) => ({
    category: c.category,
    score: live ? (c.total ? Math.round((c.vulnerable / c.total) * 100) : 0) : c.score,
    vulnerable: c.vulnerable,
  }));

  return (
    <div className="space-y-6" data-testid="redteam-page">
      <PageHeader
        eyebrow={
          <>
            <Link href={`/app/projects/${data.projectId}?tab=redteam`} className="hover:text-text">
              {(data.targetName ?? 'TARGET').toUpperCase()}
            </Link>
            <span>/</span>
            <span>RED-TEAM {shortId(data.id)}</span>
          </>
        }
        title={
          <span className="flex items-center gap-3">
            {live ? 'Red-team in progress' : 'Risk report'} <StatusTag status={data.status} />
          </span>
        }
        actions={
          data.targetId && !live ? (
            <Button
              variant="primary"
              disabled={start.isPending}
              data-testid="redteam-rerun"
              onClick={() =>
                start.mutate(
                  { targetId: data.targetId ?? '' },
                  {
                    onSuccess: ({ redteamRunId }) => router.push(`/app/redteam/${redteamRunId}`),
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              <Radar /> Run again
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Panel
          title="RISK SCORE"
          action={live ? <Led tone="info" pulse label={`${done}/${data.total}`} /> : null}
        >
          <div className="flex flex-col gap-6 py-2">
            <RiskGauge score={live ? null : data.riskScore} level={live ? null : data.riskLevel} />
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-line bg-line [&>*]:bg-panel [&>*]:p-3">
              <div className="space-y-1.5">
                <div className="label-mono">LANDED</div>
                <div className="num text-[22px] text-text">
                  <RollingNumber value={`${data.vulnerable}/${data.total}`} />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="label-mono">CRITICAL</div>
                <div className={cn('num text-[22px]', severities('CRITICAL') ? 'text-fail' : 'text-text')}>
                  {severities('CRITICAL')}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="label-mono">HIGH</div>
                <div className={cn('num text-[22px]', severities('HIGH') ? 'text-fail' : 'text-text')}>
                  {severities('HIGH')}
                </div>
              </div>
            </div>
          </div>
        </Panel>
        <Panel
          title="THREAT RADAR"
          action={<span className="num text-[11px] text-muted">risk per category · 0–100</span>}
        >
          <ThreatRadar points={radar} live={live} className="mx-auto max-w-[440px]" />
        </Panel>
      </div>

      <Panel title="BY CATEGORY" bodyClassName="p-0">
        <ul className="divide-y divide-line">
          {data.categories.map((category) => (
            <li
              key={category.category}
              className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-4 px-4 py-3 sm:grid-cols-[200px_minmax(0,1fr)_64px_48px]"
            >
              <span className="text-sm text-text">{ATTACK_CATEGORY_LABELS[category.category]}</span>
              <span className="relative hidden h-1.5 overflow-hidden rounded-[1px] bg-line sm:block">
                <span
                  className={cn(
                    'absolute inset-y-0 left-0',
                    category.vulnerable === 0 ? 'bg-pass' : category.score >= 45 ? 'bg-fail' : 'bg-warn',
                  )}
                  style={{ width: `${Math.max(category.score, category.total ? 2 : 0)}%` }}
                />
              </span>
              <span className="num text-right text-[12px] text-muted">
                {category.vulnerable}/{category.total}
              </span>
              <span
                className={cn(
                  'num hidden text-right text-sm sm:block',
                  category.vulnerable === 0 ? 'text-muted' : category.score >= 45 ? 'text-fail' : 'text-warn',
                )}
              >
                {category.score}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title={`INCIDENT LOG · ${done}/${data.total}`}
        bodyClassName="p-0"
        action={
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
            <Switch
              checked={landedOnly}
              onCheckedChange={setLandedOnly}
              aria-label="Landed attacks only"
              data-testid="filter-landed"
            />
            Landed only
          </label>
        }
      >
        {shown.length === 0 ? (
          <EmptyState
            title={live ? 'Attacks are on their way' : 'Nothing landed'}
            text={
              live
                ? 'Findings appear here as each attack finishes.'
                : 'Every attack was blocked. Run again after each prompt change.'
            }
            className="py-10"
          />
        ) : (
          <ol className="divide-y divide-line">
            {shown.map((finding) => (
              <FindingRow
                key={finding.id}
                finding={finding}
                open={openId === finding.id}
                onToggle={() => setOpenId((id) => (id === finding.id ? null : finding.id))}
              />
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

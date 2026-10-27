'use client';

import { ATTACK_CATEGORIES, ATTACK_CATEGORY_LABELS, type AttackCategory } from '@evalpilot/shared';
import { Radar } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { useAttacks, useRedteamRuns, useStartRedteam, useTargets } from '@/lib/queries';
import { Panel } from '../instruments/panel';
import { EmptyState, ErrorState, ScanRows } from '../instruments/states';
import { riskTone, StatusTag, Tag } from '../instruments/status';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog';
import { Field, Select } from '../ui/field';

const TONE_TEXT = {
  pass: 'text-pass',
  warn: 'text-warn',
  fail: 'text-fail',
  muted: 'text-muted',
  info: 'text-info',
  signal: 'text-signal',
} as const;

export function StartRedteamDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const targets = useTargets(projectId);
  const attacks = useAttacks();
  const start = useStartRedteam(projectId);
  const [targetId, setTargetId] = useState('');
  const [categories, setCategories] = useState<Set<AttackCategory>>(new Set(ATTACK_CATEGORIES));
  const chosenTarget = targetId !== '' ? targetId : (targets.data?.[0]?.id ?? '');
  const count = attacks.data?.filter((attack) => categories.has(attack.category)).length ?? 0;

  const toggle = (category: AttackCategory) =>
    setCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Start a red-team run"
        description="Sends every selected attack to the target and scores what got through."
      >
        <div className="space-y-5">
          <Field id="redteam-target" label="Target">
            <Select
              id="redteam-target"
              value={chosenTarget}
              onChange={(e) => setTargetId(e.target.value)}
              data-testid="redteam-target"
            >
              {targets.data?.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name}
                </option>
              ))}
            </Select>
          </Field>
          <fieldset className="space-y-2">
            <legend className="label-mono mb-2">Attack categories</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ATTACK_CATEGORIES.map((category) => {
                const total = attacks.data?.filter((a) => a.category === category).length ?? 0;
                const checked = categories.has(category);
                return (
                  <label
                    key={category}
                    className={cn(
                      'panel flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors',
                      checked ? 'border-line-strong' : 'opacity-60',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--signal)]"
                      checked={checked}
                      onChange={() => toggle(category)}
                      data-testid={`redteam-category-${category}`}
                    />
                    <span className="flex-1 text-sm">{ATTACK_CATEGORY_LABELS[category]}</span>
                    <span className="num text-[12px] text-muted">{total}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!chosenTarget || categories.size === 0 || start.isPending}
            data-testid="redteam-start-submit"
            onClick={() =>
              start.mutate(
                {
                  targetId: chosenTarget,
                  categories: categories.size === ATTACK_CATEGORIES.length ? undefined : [...categories],
                },
                {
                  onSuccess: ({ redteamRunId }) => router.push(`/app/redteam/${redteamRunId}`),
                  onError: (error) => toast.error(error.message),
                },
              )
            }
          >
            <Radar /> Launch {count} attacks
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RedteamTab({ projectId, onNew }: { projectId: string; onNew: () => void }) {
  const runs = useRedteamRuns(projectId);
  if (runs.isLoading) return <ScanRows rows={3} />;
  if (runs.error) return <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />;
  if (!runs.data?.length) {
    return (
      <Panel>
        <EmptyState
          title="No red-team runs"
          text="Fire 26 attacks at your bot: prompt injection, jailbreaks, prompt leaks, PII and more."
          action={
            <Button variant="primary" onClick={onNew}>
              <Radar /> Start red-team
            </Button>
          }
        />
      </Panel>
    );
  }
  return (
    <Panel title={`RED-TEAM RUNS · ${runs.data.length}`} bodyClassName="p-0">
      <ul className="divide-y divide-line">
        {runs.data.map((run) => (
          <li key={run.id}>
            <Link
              href={`/app/redteam/${run.id}`}
              data-testid="redteam-row"
              className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 transition-colors hover:bg-panel-2"
            >
              <span
                className={cn('num text-[26px] leading-none font-medium', TONE_TEXT[riskTone(run.riskScore)])}
              >
                {run.riskScore ?? '—'}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  {run.riskLevel ? (
                    <Tag tone={riskTone(run.riskScore)}>{run.riskLevel} RISK</Tag>
                  ) : (
                    <StatusTag status={run.status} />
                  )}
                  <span className="truncate text-sm text-text">{run.targetName ?? 'Deleted target'}</span>
                </span>
                <span className="num mt-1 block text-[12px] text-muted">
                  {run.vulnerable}/{run.total} attacks landed
                </span>
              </span>
              <span className="num text-right text-[12px] text-muted">{formatRelative(run.createdAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

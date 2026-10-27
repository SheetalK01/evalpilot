'use client';

import { createSuiteSchema } from '@evalpilot/shared';
import { Play, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { formatPercent, formatRelative } from '@/lib/format';
import { useCreateSuite, useStartRun, useSuites, useTargets } from '@/lib/queries';
import { zodResolver } from '@/lib/zod-resolver';
import { Panel } from '../instruments/panel';
import { EmptyState, ErrorState, ScanRows } from '../instruments/states';
import { StatusTag, Tag } from '../instruments/status';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog';
import { Field, Input, Select, Textarea } from '../ui/field';

const blankToUndefined = (value: string | undefined) =>
  value === undefined || value === '' ? undefined : value;

const suiteForm = createSuiteSchema.extend({ passThreshold: z.coerce.number().min(0).max(100) });

export function NewSuiteDialog({
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
  const create = useCreateSuite(projectId);
  const form = useForm({
    resolver: zodResolver(suiteForm),
    defaultValues: { name: '', description: '', targetId: '', passThreshold: 90 },
  });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit((values) =>
    create.mutate(
      {
        name: values.name,
        description: blankToUndefined(values.description),
        targetId: blankToUndefined(values.targetId),
        passThreshold: values.passThreshold / 100,
      },
      {
        onSuccess: (suite) => {
          onOpenChange(false);
          form.reset();
          router.push(`/app/suites/${suite.id}`);
        },
        onError: (error) => toast.error(error.message),
      },
    ),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="New suite"
        description="A suite is a list of test cases you run against one target."
      >
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-5" noValidate>
          <Field id="suite-name" label="Name" error={errors.name?.message}>
            <Input
              id="suite-name"
              autoFocus
              placeholder="Refunds & returns"
              data-testid="suite-name"
              aria-invalid={Boolean(errors.name)}
              {...form.register('name')}
            />
          </Field>
          <Field id="suite-target" label="Target">
            <Select id="suite-target" data-testid="suite-target" {...form.register('targetId')}>
              <option value="">Choose later</option>
              {targets.data?.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="suite-threshold"
            label="Pass threshold (%)"
            hint="The run fails below this pass rate (and so does the CI gate)."
            error={errors.passThreshold?.message}
          >
            <Input
              id="suite-threshold"
              type="number"
              min={0}
              max={100}
              mono
              {...form.register('passThreshold')}
            />
          </Field>
          <Field id="suite-description" label="Description (optional)">
            <Textarea id="suite-description" rows={2} {...form.register('description')} />
          </Field>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="primary"
              disabled={create.isPending}
              data-testid="suite-create-submit"
            >
              Create suite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SuitesTab({ projectId, onNew }: { projectId: string; onNew: () => void }) {
  const suites = useSuites(projectId);
  const startRun = useStartRun();
  const router = useRouter();

  if (suites.isLoading) return <ScanRows rows={3} />;
  if (suites.error) return <ErrorState error={suites.error} onRetry={() => void suites.refetch()} />;
  if (!suites.data?.length) {
    return (
      <Panel>
        <EmptyState
          title="No test suites"
          text="Write the questions your users ask and what a good answer must contain."
          action={
            <Button variant="primary" onClick={onNew}>
              <Plus /> New suite
            </Button>
          }
        />
      </Panel>
    );
  }
  return (
    <Panel title={`SUITES · ${suites.data.length}`} bodyClassName="p-0">
      <ul className="divide-y divide-line">
        {suites.data.map((suite) => (
          <li
            key={suite.id}
            data-testid="suite-row"
            className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4"
          >
            <div className="min-w-0 flex-1 basis-60">
              <Link
                href={`/app/suites/${suite.id}`}
                className="text-[15px] text-text hover:text-signal"
                data-testid="suite-link"
              >
                {suite.name}
              </Link>
              <div className="num mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                <span>{suite.caseCount} cases</span>
                <span>threshold {formatPercent(suite.passThreshold)}</span>
                <span>{suite.target ? `→ ${suite.target.name}` : 'no target'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {suite.lastRun ? (
                <Link
                  href={`/app/runs/${suite.lastRun.id}`}
                  className="flex items-center gap-2.5 hover:opacity-80"
                >
                  <StatusTag status={suite.lastRun.status} />
                  <span className="num text-sm">{formatPercent(suite.lastRun.passRate)}</span>
                  <span className="num hidden text-[12px] text-muted sm:inline">
                    {formatRelative(suite.lastRun.createdAt)}
                  </span>
                </Link>
              ) : (
                <Tag>NEVER RUN</Tag>
              )}
              <Button
                size="sm"
                disabled={!suite.targetId || suite.caseCount === 0 || startRun.isPending}
                data-testid="suite-run"
                onClick={() =>
                  startRun.mutate(suite.id, {
                    onSuccess: ({ runId }) => router.push(`/app/runs/${runId}`),
                    onError: (error) => toast.error(error.message),
                  })
                }
              >
                <Play /> Run
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

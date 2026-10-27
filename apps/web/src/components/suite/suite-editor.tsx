'use client';

import type { CsvImportResultResponse, TestCaseResponse } from '@evalpilot/shared';
import { ArrowDown, ArrowUp, Download, Pencil, Play, Plus, Trash2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { download } from '@/lib/api';
import { formatPercent } from '@/lib/format';
import {
  useCases,
  useDeleteCase,
  useImportCases,
  useProject,
  useReorderCases,
  useStartRun,
  useSuite,
  useSuiteRuns,
  useTargets,
  useUpdateSuite,
} from '@/lib/queries';
import { ConfirmDialog } from '../common/confirm-dialog';
import { Panel } from '../instruments/panel';
import { EmptyState, ErrorState, Scan, ScanRows } from '../instruments/states';
import { Tag } from '../instruments/status';
import { RunRows } from '../runs/run-rows';
import { useCurrentProject } from '../shell/deck-context';
import { PageHeader } from '../shell/page-header';
import { RUN_SHORTCUT_EVENT } from '../shell/shortcuts';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog';
import { Input, Label, Select } from '../ui/field';
import { Kbd } from '../ui/misc';
import { CaseDrawer } from './case-drawer';
import { describeCheck } from './check-builder';

function SuiteSettings({ suiteId, projectId }: { suiteId: string; projectId: string }) {
  const suite = useSuite(suiteId);
  const targets = useTargets(projectId);
  const update = useUpdateSuite(suiteId);
  const [threshold, setThreshold] = useState<string | null>(null);
  if (!suite.data) return null;
  const save = (body: Parameters<typeof update.mutate>[0]) =>
    update.mutate(body, {
      onSuccess: () => toast.success('Suite saved'),
      onError: (e) => toast.error(e.message),
    });
  const shown = threshold ?? String(Math.round(suite.data.passThreshold * 100));

  return (
    <div className="panel grid gap-px overflow-hidden bg-line sm:grid-cols-3 [&>*]:bg-panel [&>*]:p-4">
      <div className="space-y-2">
        <Label htmlFor="suite-target-select">Target</Label>
        <Select
          id="suite-target-select"
          value={suite.data.targetId ?? ''}
          onChange={(e) => save({ targetId: e.target.value || null })}
          data-testid="suite-target-select"
        >
          <option value="">No target</option>
          {targets.data?.map((target) => (
            <option key={target.id} value={target.id}>
              {target.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="suite-threshold-input">Pass threshold</Label>
        <div className="relative">
          <Input
            id="suite-threshold-input"
            type="number"
            min={0}
            max={100}
            mono
            value={shown}
            onChange={(e) => setThreshold(e.target.value)}
            onBlur={() => {
              const value = Number(shown);
              if (threshold !== null && value >= 0 && value <= 100) save({ passThreshold: value / 100 });
              setThreshold(null);
            }}
            className="pr-8"
            data-testid="suite-threshold"
          />
          <span className="num pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-muted">
            %
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="label-mono">Last run</div>
        <div className="num flex h-9 items-center text-[22px]">
          {suite.data.lastRun ? (
            <Link
              href={`/app/runs/${suite.data.lastRun.id}`}
              className={
                suite.data.lastRun.status === 'PASSED'
                  ? 'text-pass'
                  : suite.data.lastRun.status === 'FAILED'
                    ? 'text-fail'
                    : 'text-text'
              }
            >
              {formatPercent(suite.data.lastRun.passRate)}
            </Link>
          ) : (
            <span className="text-muted">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ImportResultDialog({
  result,
  onClose,
}: {
  result: CsvImportResultResponse | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={result !== null && result.errors.length > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={`Imported ${result?.imported ?? 0} cases`}
        description={`${result?.errors.length ?? 0} ${result?.errors.length === 1 ? 'row was' : 'rows were'} skipped. Fix ${result?.errors.length === 1 ? 'it' : 'them'} and import again.`}
      >
        <ul className="num max-h-80 divide-y divide-line overflow-y-auto text-[12px]">
          {result?.errors.map((error) => (
            <li key={`${error.row}-${error.message}`} className="grid grid-cols-[64px_1fr] gap-3 py-2">
              <span className="text-muted">ROW {error.row}</span>
              <span className="text-fail">{error.message}</span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="primary" onClick={onClose}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SuiteEditor({ suiteId }: { suiteId: string }) {
  const router = useRouter();
  const suite = useSuite(suiteId);
  useCurrentProject(suite.data?.projectId);
  const project = useProject(suite.data?.projectId ?? '');
  const cases = useCases(suiteId);
  const runs = useSuiteRuns(suiteId);
  const startRun = useStartRun();
  const reorder = useReorderCases(suiteId);
  const remove = useDeleteCase(suiteId);
  const importCsv = useImportCases(suiteId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<TestCaseResponse | 'new' | null>(null);
  const [deleting, setDeleting] = useState<TestCaseResponse | null>(null);
  const [importResult, setImportResult] = useState<CsvImportResultResponse | null>(null);

  const caseCount = cases.data?.length ?? 0;
  const canRun = Boolean(suite.data?.targetId) && caseCount > 0;
  const run = () => {
    if (!canRun || startRun.isPending) return;
    startRun.mutate(suiteId, {
      onSuccess: ({ runId }) => router.push(`/app/runs/${runId}`),
      onError: (error) => toast.error(error.message),
    });
  };
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    const onShortcut = () => runRef.current();
    window.addEventListener(RUN_SHORTCUT_EVENT, onShortcut);
    return () => window.removeEventListener(RUN_SHORTCUT_EVENT, onShortcut);
  }, []);

  const move = (index: number, direction: -1 | 1) => {
    if (!cases.data) return;
    const ids = cases.data.map((c) => c.id);
    const [moved] = ids.splice(index, 1);
    if (!moved) return;
    ids.splice(index + direction, 0, moved);
    reorder.mutate(ids, { onError: (error) => toast.error(error.message) });
  };

  if (suite.isLoading) {
    return (
      <div className="space-y-6">
        <Scan className="h-10 w-80" />
        <Scan className="h-24" />
        <Scan className="h-80" />
      </div>
    );
  }
  if (suite.error || !suite.data)
    return <ErrorState error={suite.error} onRetry={() => void suite.refetch()} />;

  return (
    <div className="space-y-6" data-testid="suite-page">
      <PageHeader
        eyebrow={
          <>
            <Link href={`/app/projects/${suite.data.projectId}`} className="hover:text-text">
              {(project.data?.name ?? 'PROJECT').toUpperCase()}
            </Link>
            <span>/</span>
            <span>SUITE</span>
          </>
        }
        title={suite.data.name}
        description={suite.data.description ?? undefined}
        actions={
          <Button
            variant="primary"
            size="lg"
            onClick={run}
            disabled={!canRun || startRun.isPending}
            data-testid="run-button"
            title={canRun ? 'Run (R)' : 'Add a target and at least one case first'}
          >
            <Play /> {startRun.isPending ? 'Starting…' : 'Run suite'}{' '}
            <Kbd className="border-transparent bg-[color-mix(in_oklab,var(--signal-ink)_14%,transparent)] text-signal-ink">
              R
            </Kbd>
          </Button>
        }
      />
      <SuiteSettings suiteId={suiteId} projectId={suite.data.projectId} />

      <Panel
        title={`TEST CASES · ${cases.data?.length ?? 0}`}
        bodyClassName="p-0"
        action={
          <div className="flex items-center gap-1">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              data-testid="csv-import-input"
              aria-label="Import test cases from CSV"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                void file.text().then((text) =>
                  importCsv.mutate(text, {
                    onSuccess: (result) => {
                      toast.success(
                        `Imported ${result.imported} test cases${result.errors.length ? `, skipped ${result.errors.length}` : ''}`,
                      );
                      setImportResult(result);
                    },
                    onError: (error) => toast.error(error.message),
                  }),
                );
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fileRef.current?.click()}
              data-testid="csv-import"
            >
              <Upload /> Import
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void download(`/suites/${suiteId}/export.csv`, 'cases.csv').catch((e: unknown) =>
                  toast.error(e instanceof Error ? e.message : 'Download failed'),
                )
              }
              data-testid="csv-export"
            >
              <Download /> Export
            </Button>
            <Button size="sm" onClick={() => setEditing('new')} data-testid="add-case-button">
              <Plus /> Add case
            </Button>
          </div>
        }
      >
        {cases.isLoading ? (
          <ScanRows className="p-4" rows={4} />
        ) : cases.error ? (
          <ErrorState className="m-4" error={cases.error} onRetry={() => void cases.refetch()} />
        ) : cases.data?.length === 0 ? (
          <EmptyState
            title="No test cases"
            text="Add the questions your users ask, or import a CSV (name, input, checks, tags)."
            className="py-10"
            action={
              <Button variant="primary" onClick={() => setEditing('new')}>
                <Plus /> Add case
              </Button>
            }
          />
        ) : (
          <ol className="divide-y divide-line">
            {cases.data?.map((testCase, index) => (
              <li
                key={testCase.id}
                data-testid="case-row"
                className="group grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 px-4 py-3.5 lg:grid-cols-[28px_minmax(0,1.2fr)_minmax(0,1fr)_auto]"
              >
                <span className="num pt-0.5 text-[12px] text-muted">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setEditing(testCase)}
                    className="block max-w-full truncate text-left text-sm text-text hover:text-signal"
                    data-testid="case-name-button"
                  >
                    {testCase.name}
                  </button>
                  <p className="num mt-1 truncate text-[12px] text-muted">{testCase.input}</p>
                </div>
                <div className="col-span-3 col-start-2 flex flex-wrap gap-1.5 lg:col-span-1 lg:col-start-auto">
                  {testCase.checks.map((check, i) => (
                    <span
                      key={i}
                      className="max-w-56 truncate rounded-xs border border-line bg-bg px-1.5 py-0.5 font-mono text-[11px] text-muted"
                    >
                      {describeCheck(check)}
                    </span>
                  ))}
                  {testCase.tags.map((tag) => (
                    <Tag key={tag} className="h-[20px]">
                      #{tag}
                    </Tag>
                  ))}
                </div>
                <div className="col-start-3 row-start-1 flex items-center gap-0.5 opacity-100 transition-opacity lg:col-start-4 lg:opacity-60 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Move ${testCase.name} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    data-testid="case-move-up"
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Move ${testCase.name} down`}
                    disabled={index === caseCount - 1}
                    onClick={() => move(index, 1)}
                    data-testid="case-move-down"
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Edit ${testCase.name}`}
                    onClick={() => setEditing(testCase)}
                    data-testid="case-edit"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete ${testCase.name}`}
                    onClick={() => setDeleting(testCase)}
                    data-testid="case-delete"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel title="RUN HISTORY" bodyClassName="p-0">
        {runs.isLoading ? (
          <ScanRows className="p-4" rows={3} />
        ) : runs.data?.length ? (
          <RunRows runs={runs.data} showSuite={false} />
        ) : (
          <EmptyState
            title="Not run yet"
            text="Press Run suite (or R) to send every case to the target."
            className="py-8"
          />
        )}
      </Panel>

      {editing ? (
        <CaseDrawer
          key={editing === 'new' ? 'new' : editing.id}
          suiteId={suiteId}
          testCase={editing === 'new' ? null : editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ''}”?`}
        description="Past results keep its name, but it will not run again."
        confirmLabel="Delete case"
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
            onError: (e) => toast.error(e.message),
          })
        }
      />
      <ImportResultDialog result={importResult} onClose={() => setImportResult(null)} />
    </div>
  );
}

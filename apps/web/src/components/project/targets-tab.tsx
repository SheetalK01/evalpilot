'use client';

import { HTTP_METHODS, type TargetResponse } from '@evalpilot/shared';
import { Plus, Radio, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { formatMs } from '@/lib/format';
import { useDeleteTarget, usePingTarget, useSaveTarget, useTargets } from '@/lib/queries';
import { ConfirmDialog } from '../common/confirm-dialog';
import { Panel } from '../instruments/panel';
import { EmptyState, ErrorState, ScanRows } from '../instruments/states';
import { Tag } from '../instruments/status';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog';
import { Field, Input, Select, Textarea } from '../ui/field';

interface Header {
  name: string;
  value: string;
}

interface Draft {
  type: 'HTTP' | 'SHOPBOT';
  name: string;
  url: string;
  method: (typeof HTTP_METHODS)[number];
  headers: Header[];
  bodyTemplate: string;
  responsePath: string;
  timeoutMs: number;
}

const EMPTY: Draft = {
  type: 'HTTP',
  name: '',
  url: '',
  method: 'POST',
  headers: [],
  bodyTemplate: '{"message": "{{input}}"}',
  responsePath: '$.reply',
  timeoutMs: 15000,
};

const toDraft = (target: TargetResponse): Draft => ({
  type: target.type,
  name: target.name,
  url: target.url ?? '',
  method: target.method,
  headers: Object.entries(target.headers).map(([name, value]) => ({ name, value })),
  bodyTemplate: target.bodyTemplate ?? '',
  responsePath: target.responsePath ?? '$',
  timeoutMs: target.timeoutMs,
});

/** Add or edit a target. Header values come back masked; unchanged masks keep the stored secret. */
export function TargetDialog({
  projectId,
  target,
  open,
  onOpenChange,
}: {
  projectId: string;
  target: TargetResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveTarget(projectId);
  const [draft, setDraft] = useState<Draft>(target ? toDraft(target) : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const editing = target !== null;

  const submit = () => {
    const headers = Object.fromEntries(
      draft.headers.filter((h) => h.name.trim()).map((h) => [h.name.trim(), h.value]),
    );
    const body =
      draft.type === 'SHOPBOT'
        ? { ...(editing ? {} : { type: 'SHOPBOT' }), name: draft.name, timeoutMs: draft.timeoutMs }
        : {
            ...(editing ? {} : { type: 'HTTP' }),
            name: draft.name,
            url: draft.url,
            method: draft.method,
            headers,
            bodyTemplate: draft.method === 'GET' ? undefined : draft.bodyTemplate,
            responsePath: draft.responsePath,
            timeoutMs: draft.timeoutMs,
          };
    save.mutate(
      { id: target?.id, body },
      {
        onSuccess: () => {
          toast.success(editing ? 'Target saved' : 'Target added');
          onOpenChange(false);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.fieldErrors.length)
            setErrors(Object.fromEntries(error.fieldErrors.map((e) => [e.path, e.message])));
          else toast.error(error.message);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        side="right"
        title={editing ? `Edit ${target.name}` : 'Add a target'}
        description="Where EvalPilot sends each test input. The answer is read from the JSON response."
      >
        <form
          className="space-y-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setErrors({});
            submit();
          }}
        >
          {editing ? null : (
            <div role="radiogroup" aria-label="Target type" className="grid grid-cols-2 gap-2">
              {(['HTTP', 'SHOPBOT'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={draft.type === type}
                  onClick={() => set('type', type)}
                  data-testid={`target-type-${type.toLowerCase()}`}
                  className={`panel p-3 text-left transition-colors ${draft.type === type ? 'border-signal' : 'hover:border-line-strong'}`}
                >
                  <div className="label-mono text-text">
                    {type === 'HTTP' ? 'HTTP ENDPOINT' : 'SHOPBOT DEMO'}
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    {type === 'HTTP' ? 'Any chatbot with a JSON API' : 'The built-in support bot'}
                  </div>
                </button>
              ))}
            </div>
          )}
          <Field id="target-name" label="Name" error={errors.name}>
            <Input
              id="target-name"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={draft.type === 'HTTP' ? 'Production bot' : 'ShopBot'}
              data-testid="target-name"
            />
          </Field>
          {draft.type === 'HTTP' ? (
            <>
              <div className="grid grid-cols-[110px_1fr] gap-3">
                <Field id="target-method" label="Method">
                  <Select
                    id="target-method"
                    value={draft.method}
                    onChange={(e) => set('method', e.target.value as Draft['method'])}
                  >
                    {HTTP_METHODS.map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </Select>
                </Field>
                <Field id="target-url" label="URL" error={errors.url}>
                  <Input
                    id="target-url"
                    mono
                    value={draft.url}
                    onChange={(e) => set('url', e.target.value)}
                    placeholder="https://bot.example.com/chat"
                    data-testid="target-url"
                  />
                </Field>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="label-mono">Headers</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => set('headers', [...draft.headers, { name: '', value: '' }])}
                    data-testid="target-header-add"
                  >
                    <Plus /> Add header
                  </Button>
                </div>
                {draft.headers.length === 0 ? (
                  <p className="text-[13px] text-muted">
                    No headers. Secrets (API keys) are encrypted at rest and shown masked.
                  </p>
                ) : null}
                {draft.headers.map((header, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                    <Input
                      mono
                      aria-label="Header name"
                      placeholder="Authorization"
                      value={header.name}
                      onChange={(e) =>
                        set(
                          'headers',
                          draft.headers.map((h, i) => (i === index ? { ...h, name: e.target.value } : h)),
                        )
                      }
                    />
                    <Input
                      mono
                      aria-label="Header value"
                      placeholder="Bearer sk-…"
                      value={header.value}
                      onChange={(e) =>
                        set(
                          'headers',
                          draft.headers.map((h, i) => (i === index ? { ...h, value: e.target.value } : h)),
                        )
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Remove header"
                      onClick={() =>
                        set(
                          'headers',
                          draft.headers.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <X />
                    </Button>
                  </div>
                ))}
              </div>
              {draft.method === 'GET' ? null : (
                <Field
                  id="target-body"
                  label="Body template"
                  hint="{{input}} is replaced with the test input (JSON-escaped)."
                  error={errors.bodyTemplate}
                >
                  <Textarea
                    id="target-body"
                    mono
                    rows={3}
                    value={draft.bodyTemplate}
                    onChange={(e) => set('bodyTemplate', e.target.value)}
                    data-testid="target-body"
                  />
                </Field>
              )}
              <Field
                id="target-path"
                label="Answer path"
                hint="Where the answer is in the JSON response, e.g. $.choices[0].message.content"
                error={errors.responsePath}
              >
                <Input
                  id="target-path"
                  mono
                  value={draft.responsePath}
                  onChange={(e) => set('responsePath', e.target.value)}
                />
              </Field>
            </>
          ) : (
            <p className="panel p-3 text-[13px] text-muted">
              ShopBot runs next to EvalPilot (SHOPBOT_URL). It is deliberately vulnerable to a few attacks, so
              the red-team demo has findings.
            </p>
          )}
          <Field id="target-timeout" label="Timeout (ms)" error={errors.timeoutMs}>
            <Input
              id="target-timeout"
              type="number"
              mono
              min={1000}
              max={60000}
              step={500}
              value={draft.timeoutMs}
              onChange={(e) => set('timeoutMs', Number(e.target.value))}
            />
          </Field>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={save.isPending} data-testid="target-save">
              {editing ? 'Save target' : 'Add target'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PingResult({ targetId }: { targetId: string }) {
  const ping = usePingTarget();
  return (
    <div className="flex items-center gap-3">
      {ping.data ? (
        <span className="num max-w-64 truncate text-[12px]" data-testid="ping-result">
          {ping.data.ok ? (
            <span className="text-pass">OK · {formatMs(ping.data.latencyMs)}</span>
          ) : (
            <span className="text-fail">{ping.data.error}</span>
          )}
        </span>
      ) : ping.error ? (
        <span className="num max-w-64 truncate text-[12px] text-fail">{ping.error.message}</span>
      ) : null}
      <Button
        size="sm"
        onClick={() => ping.mutate(targetId)}
        disabled={ping.isPending}
        data-testid="target-ping"
      >
        <Radio /> {ping.isPending ? 'Pinging…' : 'Ping'}
      </Button>
    </div>
  );
}

export function TargetsTab({ projectId, onNew }: { projectId: string; onNew: () => void }) {
  const targets = useTargets(projectId);
  const remove = useDeleteTarget(projectId);
  const [editing, setEditing] = useState<TargetResponse | null>(null);
  const [deleting, setDeleting] = useState<TargetResponse | null>(null);

  if (targets.isLoading) return <ScanRows rows={2} />;
  if (targets.error) return <ErrorState error={targets.error} onRetry={() => void targets.refetch()} />;
  if (!targets.data?.length) {
    return (
      <Panel>
        <EmptyState
          title="No targets"
          text="Connect the AI app to test: any HTTP chatbot, or the built-in ShopBot."
          action={
            <Button variant="primary" onClick={onNew}>
              <Plus /> Add target
            </Button>
          }
        />
      </Panel>
    );
  }
  return (
    <Panel title={`TARGETS · ${targets.data.length}`} bodyClassName="p-0">
      <ul className="divide-y divide-line">
        {targets.data.map((target) => (
          <li
            key={target.id}
            data-testid="target-row"
            className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4"
          >
            <div className="min-w-0 flex-1 basis-64 space-y-1">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  className="text-[15px] text-text hover:text-signal"
                  onClick={() => setEditing(target)}
                >
                  {target.name}
                </button>
                <Tag tone={target.type === 'SHOPBOT' ? 'signal' : 'muted'}>{target.type}</Tag>
              </div>
              <div className="num truncate text-[12px] text-muted">
                {target.type === 'SHOPBOT'
                  ? 'Built-in demo · SHOPBOT_URL/chat'
                  : `${target.method} ${target.url ?? ''}`}{' '}
                · timeout {formatMs(target.timeoutMs)}
                {Object.keys(target.headers).length
                  ? ` · ${Object.keys(target.headers).length} header(s)`
                  : ''}
              </div>
            </div>
            <PingResult targetId={target.id} />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Delete ${target.name}`}
              onClick={() => setDeleting(target)}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      {editing ? (
        <TargetDialog
          key={editing.id}
          projectId={projectId}
          target={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ''}”?`}
        description="Suites that use it are kept, without a target. Past runs stay readable."
        confirmLabel="Delete target"
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Target deleted');
              setDeleting(null);
            },
            onError: (error) => toast.error(error.message),
          })
        }
      />
    </Panel>
  );
}

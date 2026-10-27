'use client';

import type { ReactNode } from 'react';
import { formatClock, formatCount, formatMs, formatUsd } from '@/lib/format';
import { useTrace } from '@/lib/queries';
import { ErrorState, Scan } from '../instruments/states';
import { StatusTag } from '../instruments/status';
import { Dialog, DialogContent } from '../ui/dialog';
import { CopyButton } from '../ui/misc';

function Section({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="label-mono">{label}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function TextBlock({ text }: { text: string | null }) {
  return (
    <pre className="num max-h-64 overflow-auto rounded-sm border border-line bg-bg p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap text-text">
      {text ?? '—'}
    </pre>
  );
}

/** Split-pane inspector: input, output, metadata and a timing waterfall for one trace. */
export function TraceInspector({ traceId, onClose }: { traceId: string | null; onClose: () => void }) {
  const trace = useTrace(traceId);
  const data = trace.data;
  const total = data ? data.inputTokens + data.outputTokens : 0;

  return (
    <Dialog open={traceId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        side="right"
        title={data ? data.name : 'Trace'}
        description={
          data ? `${data.model ?? 'unknown model'} · ${formatClock(data.startedAt)} UTC` : 'Loading…'
        }
        data-testid="trace-inspector"
      >
        {trace.isLoading ? (
          <div className="space-y-4">
            <Scan className="h-24" />
            <Scan className="h-24" />
          </div>
        ) : trace.error ? (
          <ErrorState error={trace.error} onRetry={() => void trace.refetch()} />
        ) : data ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusTag status={data.status} />
              <span className="num text-[12px] text-muted">id {data.externalId ?? data.id}</span>
            </div>
            {data.error ? (
              <p className="rounded-sm border border-[color-mix(in_oklab,var(--fail)_40%,transparent)] px-3 py-2 text-sm text-fail">
                {data.error}
              </p>
            ) : null}

            <Section label="TIMING">
              <div className="panel space-y-3 p-3">
                <div className="num flex justify-between text-[12px] text-muted">
                  <span>{formatClock(data.startedAt)}</span>
                  <span className="text-text">{formatMs(data.latencyMs)}</span>
                  <span>{formatClock(new Date(new Date(data.startedAt).getTime() + data.latencyMs))}</span>
                </div>
                <div className="relative h-6 rounded-xs bg-bg">
                  <div className="absolute inset-y-1 left-0 w-full rounded-xs bg-[color-mix(in_oklab,var(--info)_35%,transparent)]" />
                  <span className="num absolute inset-y-0 left-2 flex items-center text-[11px] text-text">
                    model call
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-[12px]">
                  {[
                    ['TOKENS IN', formatCount(data.inputTokens)],
                    ['TOKENS OUT', formatCount(data.outputTokens)],
                    ['COST', formatUsd(data.estCostUsd)],
                  ].map(([label, value]) => (
                    <div key={label} className="space-y-1">
                      <div className="label-mono">{label}</div>
                      <div className="num text-text">{value}</div>
                    </div>
                  ))}
                </div>
                {total > 0 ? (
                  <div className="flex h-1.5 overflow-hidden rounded-[1px] bg-line" aria-hidden>
                    <span className="bg-muted" style={{ width: `${(data.inputTokens / total) * 100}%` }} />
                    <span className="bg-text" style={{ width: `${(data.outputTokens / total) * 100}%` }} />
                  </div>
                ) : null}
              </div>
            </Section>

            <Section label="INPUT" action={data.input ? <CopyButton value={data.input} /> : null}>
              <TextBlock text={data.input} />
            </Section>
            <Section label="OUTPUT" action={data.output ? <CopyButton value={data.output} /> : null}>
              <TextBlock text={data.output} />
            </Section>
            <Section label="METADATA">
              {data.metadata && Object.keys(data.metadata).length > 0 ? (
                <dl className="panel divide-y divide-line">
                  {Object.entries(data.metadata).map(([key, value]) => (
                    <div key={key} className="num grid grid-cols-[140px_1fr] gap-3 px-3 py-2 text-[12px]">
                      <dt className="truncate text-muted">{key}</dt>
                      <dd className="break-all text-text">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted">No metadata.</p>
              )}
            </Section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

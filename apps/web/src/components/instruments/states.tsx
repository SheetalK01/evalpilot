'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from '../ui/button';
import { CopyButton } from '../ui/misc';

/** Line-art attitude indicator, drawn in code (no stock illustrations). */
export function InstrumentArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn('size-24 text-line-strong', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      aria-hidden
    >
      <circle cx="60" cy="60" r="46" />
      <circle cx="60" cy="60" r="38" strokeDasharray="1.5 5" />
      <path d="M22 66 Q60 56 98 66" />
      {[-30, -15, 0, 15, 30].map((deg) => (
        <line key={deg} x1="60" y1="18" x2="60" y2={deg === 0 ? 28 : 24} transform={`rotate(${deg} 60 60)`} />
      ))}
      <path d="M38 62 H52 L56 66 L60 62 L64 66 L68 62 H82" stroke="var(--signal)" strokeWidth={1.5} />
      <circle cx="60" cy="62" r="1.8" fill="var(--signal)" stroke="none" />
    </svg>
  );
}

/** Empty state: one short instruction and one action. */
export function EmptyState({
  title,
  text,
  action,
  className,
  testId,
}: {
  title: string;
  text: string;
  action?: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={cn('flex flex-col items-center px-6 py-12 text-center', className)}
      data-testid={testId ?? 'empty-state'}
    >
      <InstrumentArt />
      <h3 className="mt-5 text-lg font-medium">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{text}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Error state with the request id (copyable), so a bug report can point at the exact log line. */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  const requestId = error instanceof ApiError ? error.requestId : null;
  return (
    <div
      role="alert"
      className={cn(
        'panel flex flex-col gap-3 border-l-2 border-l-fail p-4 sm:flex-row sm:items-center',
        className,
      )}
      data-testid="error-state"
    >
      <AlertTriangle className="size-5 shrink-0 text-fail" strokeWidth={1.5} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium">{message}</p>
        {requestId ? (
          <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
            <span className="label-mono">REQUEST ID</span>
            <code className="num break-all text-text">{requestId}</code>
            <CopyButton value={requestId} label="Copy" />
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          <RotateCw /> Retry
        </Button>
      ) : null}
    </div>
  );
}

/** Skeleton block with a scanning line, shaped like the content it replaces. */
export function Scan({ className }: { className?: string }) {
  return <div aria-hidden className={cn('scan h-4', className)} />;
}

export function ScanRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Scan className="h-4 w-16" />
          <Scan className="h-4 flex-1" />
          <Scan className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

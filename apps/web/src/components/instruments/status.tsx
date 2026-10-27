import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'pass' | 'fail' | 'warn' | 'info' | 'muted' | 'signal';

const TEXT: Record<Tone, string> = {
  pass: 'text-pass',
  fail: 'text-fail',
  warn: 'text-warn',
  info: 'text-info',
  muted: 'text-muted',
  signal: 'text-signal',
};
const BG: Record<Tone, string> = {
  pass: 'bg-pass',
  fail: 'bg-fail',
  warn: 'bg-warn',
  info: 'bg-info',
  muted: 'bg-muted',
  signal: 'bg-signal',
};

/** Status light. `pulse` while something is live. */
export function Led({
  tone,
  pulse,
  label,
  className,
}: {
  tone: Tone;
  pulse?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        aria-hidden
        className={cn('size-[7px] rounded-full', BG[tone], pulse && 'animate-led')}
        style={{
          boxShadow:
            tone === 'muted' ? undefined : `0 0 8px color-mix(in oklab, var(--${tone}) 70%, transparent)`,
        }}
      />
      {label ? <span className="label-mono text-[10px] text-text">{label}</span> : null}
    </span>
  );
}

/** Mono, uppercase tag with a tinted background. Text always says the state (not colour only). */
export function Tag({
  tone = 'muted',
  children,
  className,
  testId,
  filled,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  testId?: string;
  filled?: boolean;
}) {
  return (
    <span
      data-testid={testId}
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-xs border px-1.5 font-mono text-[11px] leading-none font-medium tracking-[0.06em] uppercase',
        filled ? cn(BG[tone], 'border-transparent text-signal-ink') : TEXT[tone],
        className,
      )}
      style={
        filled
          ? undefined
          : {
              borderColor: `color-mix(in oklab, var(--${tone === 'muted' ? 'line-strong' : tone}) 40%, transparent)`,
              background: `color-mix(in oklab, var(--${tone === 'muted' ? 'line' : tone}) 9%, transparent)`,
            }
      }
    >
      {children}
    </span>
  );
}

const RUN_TONE: Record<string, Tone> = {
  PASSED: 'pass',
  FAILED: 'fail',
  ERROR: 'warn',
  RUNNING: 'info',
  QUEUED: 'muted',
  CANCELLED: 'muted',
  COMPLETED: 'pass',
  OK: 'pass',
};

const RUN_LABEL: Record<string, string> = {
  PASSED: 'PASS',
  FAILED: 'FAIL',
  ERROR: 'ERROR',
  RUNNING: 'LIVE',
  QUEUED: 'QUEUED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'DONE',
  OK: 'OK',
};

export function StatusTag({ status, testId }: { status: string; testId?: string }) {
  const tone = RUN_TONE[status] ?? 'muted';
  return (
    <Tag tone={tone} testId={testId}>
      {status === 'RUNNING' ? <Led tone="info" pulse /> : null}
      {RUN_LABEL[status] ?? status}
    </Tag>
  );
}

const SEVERITY_TONE: Record<string, Tone> = { CRITICAL: 'fail', HIGH: 'fail', MEDIUM: 'warn', LOW: 'muted' };

export function SeverityTag({ severity }: { severity: string }) {
  return (
    <Tag tone={SEVERITY_TONE[severity] ?? 'muted'} filled={severity === 'CRITICAL'}>
      {severity}
    </Tag>
  );
}

export function riskTone(score: number | null | undefined): Tone {
  if (score === null || score === undefined) return 'muted';
  if (score >= 45) return 'fail';
  if (score >= 20) return 'warn';
  return 'pass';
}

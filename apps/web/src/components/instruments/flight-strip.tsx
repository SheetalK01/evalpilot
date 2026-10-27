import { cn } from '@/lib/cn';

export type StripStatus = 'PASSED' | 'FAILED' | 'ERROR' | null;

const TICK: Record<'PASSED' | 'FAILED' | 'ERROR', string> = {
  PASSED: 'bg-pass',
  FAILED: 'bg-fail',
  ERROR: 'bg-warn',
};

/**
 * The run "flight strip": one thin tick per test case on a horizontal timeline. Ticks light up
 * as results arrive; while the run is live a cyan cursor scans the next pending case.
 */
export function FlightStrip({
  statuses,
  live,
  size = 'lg',
  className,
  label,
}: {
  statuses: StripStatus[];
  live?: boolean;
  size?: 'lg' | 'sm';
  className?: string;
  label?: string;
}) {
  const nextPending = statuses.findIndex((status) => status === null);
  const passed = statuses.filter((s) => s === 'PASSED').length;
  const failed = statuses.filter((s) => s === 'FAILED' || s === 'ERROR').length;
  const summary = label ?? `${passed} passed, ${failed} failed, ${statuses.length - passed - failed} pending`;
  // Short runs: thin, evenly spaced ticks on the timeline. Long runs: ticks share the width.
  const thin = statuses.length <= 16;

  return (
    <div
      role="img"
      aria-label={summary}
      data-testid={size === 'lg' ? 'flight-strip' : 'flight-strip-mini'}
      className={cn(
        'relative flex items-stretch',
        thin ? 'justify-between' : '',
        size === 'lg' ? 'h-14 gap-[3px]' : 'h-4 gap-px',
        className,
      )}
    >
      {statuses.map((status, index) => (
        <span
          key={index}
          className={cn(
            'relative rounded-[1px] transition-[background-color,transform] duration-200',
            thin ? (size === 'lg' ? 'w-2' : 'w-[3px]') : 'min-w-px flex-1',
            status ? TICK[status] : 'bg-line',
            size === 'lg' && status === 'FAILED' && 'scale-y-[1.12]',
          )}
        >
          {live && index === nextPending ? (
            <span
              aria-hidden
              className="absolute inset-y-[-4px] -left-px w-[3px] animate-cursor rounded-full bg-info shadow-[0_0_10px_var(--info)]"
            />
          ) : null}
        </span>
      ))}
      {live && size === 'lg' ? (
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-xs">
          <span className="absolute inset-y-0 w-1/3 animate-scan bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--info)_14%,transparent),transparent)]" />
        </span>
      ) : null}
    </div>
  );
}

/** Mini strip from the compact "PPFE" string returned in run lists. */
export function MiniStrip({ strip, total, className }: { strip: string; total: number; className?: string }) {
  const map: Record<string, StripStatus> = { P: 'PASSED', F: 'FAILED', E: 'ERROR' };
  const statuses: StripStatus[] = Array.from(
    { length: Math.max(total, strip.length) },
    (_, i) => map[strip.charAt(i)] ?? null,
  );
  return <FlightStrip statuses={statuses} size="sm" className={cn('w-28', className)} />;
}

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Hairline instrument panel with crosshair corner marks and an optional mono header. */
export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
  crosshair = true,
  as: Tag = 'section',
  ...rest
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  crosshair?: boolean;
  as?: 'section' | 'div' | 'article';
  'data-testid'?: string;
  'aria-label'?: string;
}) {
  return (
    <Tag className={cn('panel', crosshair && 'crosshair', className)} {...rest}>
      {title || action ? (
        <header className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          {typeof title === 'string' ? <h2 className="label-mono">{title}</h2> : title}
          {action}
        </header>
      ) : null}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </Tag>
  );
}

/** Instrument readout: small uppercase label above a large mono value. */
export function Readout({
  label,
  value,
  sub,
  tone,
  className,
  testId,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'pass' | 'fail' | 'warn' | 'info' | 'signal';
  className?: string;
  testId?: string;
}) {
  const toneClass = tone
    ? { pass: 'text-pass', fail: 'text-fail', warn: 'text-warn', info: 'text-info', signal: 'text-signal' }[
        tone
      ]
    : 'text-text';
  return (
    <div className={cn('min-w-0 space-y-2.5', className)} data-testid={testId}>
      <div className="label-mono truncate">{label}</div>
      <div
        className={cn('num text-[28px] leading-none font-medium tracking-tight sm:text-[32px]', toneClass)}
      >
        {value}
      </div>
      {sub ? <div className="num truncate text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

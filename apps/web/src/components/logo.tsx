import { cn } from '@/lib/cn';

/** Mark: an attitude-indicator horizon with a check above it. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-6', className)} fill="none" aria-hidden>
      <circle cx="16" cy="16" r="13" stroke="var(--signal)" strokeWidth={1.75} />
      <path d="M5 18.5 H27" stroke="var(--signal)" strokeWidth={1.75} strokeLinecap="round" />
      <path
        d="M11 12.5 L14.5 15.5 L21.5 8.5"
        stroke="var(--signal)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {compact ? null : (
        <span className="font-mono text-[13px] font-semibold tracking-[0.18em] text-text">EVALPILOT</span>
      )}
    </span>
  );
}

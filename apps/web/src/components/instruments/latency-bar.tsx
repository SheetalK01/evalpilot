import { cn } from '@/lib/cn';
import { formatMs } from '@/lib/format';

/** Latency as a bar scaled to `max`. Colour is absolute: neutral under 1 s, amber to 3 s, red above. */
export function LatencyBar({ ms, max, className }: { ms: number | null; max: number; className?: string }) {
  if (ms === null) return <span className="num text-xs text-muted">—</span>;
  const ratio = max > 0 ? Math.min(1, ms / max) : 0;
  const tone = ms > 3000 ? 'bg-fail' : ms >= 1000 ? 'bg-warn' : 'bg-muted';
  return (
    <span className={cn('inline-flex w-full items-center gap-2', className)}>
      <span className="num w-14 shrink-0 text-right text-xs text-muted">{formatMs(ms)}</span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-[1px] bg-line">
        <span
          className={cn('absolute inset-y-0 left-0 rounded-[1px]', tone)}
          style={{ width: `${Math.max(2, ratio * 100)}%` }}
        />
      </span>
    </span>
  );
}

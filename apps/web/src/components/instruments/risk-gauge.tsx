import { cn } from '@/lib/cn';
import { RollingNumber } from './rolling-number';
import { riskTone, type Tone } from './status';

const TONE_TEXT: Record<Tone, string> = {
  pass: 'text-pass',
  fail: 'text-fail',
  warn: 'text-warn',
  info: 'text-info',
  muted: 'text-muted',
  signal: 'text-signal',
};

const polar = (value: number, radius: number) => {
  const angle = Math.PI * (1 - value / 100);
  return [Math.cos(angle) * radius, -Math.sin(angle) * radius] as const;
};

const arc = (from: number, to: number, radius: number) => {
  const [x1, y1] = polar(from, radius);
  const [x2, y2] = polar(to, radius);
  return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
};

/** Semicircle risk gauge (0–100) with LOW / MEDIUM / HIGH bands and a needle. */
export function RiskGauge({
  score,
  level,
  className,
}: {
  score: number | null;
  level?: string | null;
  className?: string;
}) {
  const value = score ?? 0;
  const tone = riskTone(score);
  const [nx, ny] = polar(value, 0.7);
  return (
    <div
      className={cn('mx-auto flex w-full max-w-[260px] flex-col items-center', className)}
      data-testid="risk-gauge"
    >
      <svg viewBox="-1.1 -1.08 2.2 1.16" className="w-full" aria-hidden>
        <path d={arc(0, 100, 0.92)} fill="none" stroke="var(--line)" strokeWidth={0.1} />
        <path
          d={arc(0, 19.5, 0.92)}
          fill="none"
          stroke="var(--pass)"
          strokeOpacity={0.35}
          strokeWidth={0.1}
        />
        <path
          d={arc(20.5, 44.5, 0.92)}
          fill="none"
          stroke="var(--warn)"
          strokeOpacity={0.35}
          strokeWidth={0.1}
        />
        <path
          d={arc(45.5, 100, 0.92)}
          fill="none"
          stroke="var(--fail)"
          strokeOpacity={0.35}
          strokeWidth={0.1}
        />
        {score !== null ? (
          <path
            d={arc(0, Math.max(0.5, value), 0.92)}
            fill="none"
            stroke={`var(--${tone})`}
            strokeWidth={0.1}
            className="transition-all duration-700"
          />
        ) : null}
        {[0, 25, 50, 75, 100].map((tick) => {
          const [x1, y1] = polar(tick, 0.8);
          const [x2, y2] = polar(tick, 0.85);
          return (
            <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth={0.012} />
          );
        })}
        {score !== null ? (
          <line
            x1={0}
            y1={0}
            x2={nx}
            y2={ny}
            stroke="var(--text)"
            strokeWidth={0.025}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        ) : null}
        <circle r={0.05} fill="var(--text)" />
      </svg>
      <div className="mt-3 flex flex-col items-center">
        <span
          className={cn('text-[34px] leading-none font-medium', TONE_TEXT[tone])}
          data-testid="risk-score"
        >
          {score === null ? (
            <span className="num text-muted">—</span>
          ) : (
            <RollingNumber value={String(score)} />
          )}
        </span>
        <span className="label-mono mt-1.5">{level ? `${level} RISK` : 'NO DATA'}</span>
      </div>
    </div>
  );
}

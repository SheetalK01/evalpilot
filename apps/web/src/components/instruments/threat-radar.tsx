import { ATTACK_CATEGORIES, ATTACK_CATEGORY_LABELS, type AttackCategory } from '@evalpilot/shared';
import { cn } from '@/lib/cn';

export interface RadarPoint {
  category: AttackCategory;
  /** 0–100 risk within the category. */
  score: number;
  vulnerable: number;
}

const SHORT: Record<AttackCategory, string> = {
  PROMPT_INJECTION: 'INJECTION',
  JAILBREAK: 'JAILBREAK',
  SYSTEM_PROMPT_LEAK: 'PROMPT LEAK',
  PII_LEAK: 'PII LEAK',
  HARMFUL_CONTENT: 'HARMFUL',
  OFF_TOPIC: 'OFF-TOPIC',
};

const angle = (index: number) => -Math.PI / 2 + (index * 2 * Math.PI) / ATTACK_CATEGORIES.length;
const at = (index: number, radius: number) =>
  [Math.cos(angle(index)) * radius, Math.sin(angle(index)) * radius] as const;

/**
 * Polar chart of the six attack categories. The filled shape is the risk per category; while a
 * run is live a sweep line rotates like a radar. Drawn in SVG so it inherits the theme colours.
 */
export function ThreatRadar({
  points,
  live,
  className,
}: {
  points: RadarPoint[];
  live?: boolean;
  className?: string;
}) {
  const byCategory = new Map(points.map((point) => [point.category, point]));
  const shape = ATTACK_CATEGORIES.map((category, index) =>
    at(index, 0.06 + 0.94 * ((byCategory.get(category)?.score ?? 0) / 100)).join(','),
  ).join(' ');
  const summary = ATTACK_CATEGORIES.map(
    (c) => `${ATTACK_CATEGORY_LABELS[c]} ${byCategory.get(c)?.score ?? 0}`,
  ).join(', ');

  return (
    <svg
      viewBox="-1.8 -1.3 3.6 2.6"
      className={cn('w-full', className)}
      role="img"
      aria-label={`Risk by category: ${summary}`}
      data-testid="threat-radar"
    >
      <defs>
        <linearGradient id="sweep-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--info)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--info)" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon
          key={r}
          points={ATTACK_CATEGORIES.map((_, i) => at(i, r).join(',')).join(' ')}
          fill="none"
          stroke="var(--line)"
          strokeWidth={0.008}
        />
      ))}
      {ATTACK_CATEGORIES.map((category, index) => {
        const [x, y] = at(index, 1);
        return <line key={category} x1={0} y1={0} x2={x} y2={y} stroke="var(--line)" strokeWidth={0.008} />;
      })}
      <polygon
        points={shape}
        fill="color-mix(in oklab, var(--fail) 22%, transparent)"
        stroke="var(--fail)"
        strokeWidth={0.018}
        strokeLinejoin="round"
        className="transition-all duration-500"
      />
      {ATTACK_CATEGORIES.map((category, index) => {
        const point = byCategory.get(category);
        if (!point?.vulnerable) return null;
        const [x, y] = at(index, 0.06 + 0.94 * (point.score / 100));
        return <circle key={category} cx={x} cy={y} r={0.035} fill="var(--fail)" />;
      })}
      {live ? (
        <g
          className="origin-center animate-sweep"
          style={{ transformBox: 'view-box', transformOrigin: '0 0' }}
        >
          <path d="M0 0 L1 0 A1 1 0 0 0 0.866 -0.5 Z" fill="url(#sweep-fade)" />
          <line x1={0} y1={0} x2={1} y2={0} stroke="var(--info)" strokeWidth={0.014} />
        </g>
      ) : null}
      <circle r={0.02} fill="var(--muted)" />
      {ATTACK_CATEGORIES.map((category, index) => {
        const [x, y] = at(index, 1.17);
        const anchor = Math.abs(x) < 0.1 ? 'middle' : x > 0 ? 'start' : 'end';
        return (
          <text
            key={category}
            x={x}
            y={y + 0.035}
            textAnchor={anchor}
            fill="var(--muted)"
            fontSize={0.1}
            fontFamily="var(--font-mono)"
            letterSpacing={0.006}
          >
            {SHORT[category]}
          </text>
        );
      })}
    </svg>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

function parse(token: string): number {
  return Number(token.replace(/,/g, ''));
}

function format(value: number, template: string): string {
  const decimals = template.includes('.') ? (template.split('.')[1]?.length ?? 0) : 0;
  const grouped = template.includes(',');
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouped,
  });
}

/**
 * Builds the frame between `from` and `to` at progress `t` (0–1): every number in `to` is counted
 * from its counterpart in `from` (or 0), formatted exactly like the target, so each frame shows
 * whole, readable digits. Text around the numbers (%, ms, $, /) comes from the target.
 */
export function interpolate(from: string, to: string, t: number): string {
  const starts = (from.match(NUMBER) ?? []).map(parse);
  let index = 0;
  return to.replace(NUMBER, (token) => {
    const target = parse(token);
    const start = starts[index++] ?? 0;
    return format(start + (target - start) * t, token);
  });
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Altimeter-style readout: when the value changes, its numbers count quickly to the new value
 * (ease-out). Screen readers get the final value only; motion is off under reduced motion.
 */
export function RollingNumber({
  value,
  className,
  duration = 650,
}: {
  value: string;
  className?: string;
  duration?: number;
}) {
  const [shown, setShown] = useState(() => interpolate('', value, 0));
  const shownRef = useRef(shown);

  useEffect(() => {
    if (prefersReducedMotion()) {
      shownRef.current = value;
      setShown(value);
      return undefined;
    }
    const from = shownRef.current;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const next = t === 1 ? value : interpolate(from, value, easeOut(t));
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <span className={cn('num inline-block whitespace-nowrap', className)} role="img" aria-label={value}>
      <span aria-hidden>{shown}</span>
    </span>
  );
}

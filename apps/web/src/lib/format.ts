/** Formatting for instrument readouts. Numbers are shown in mono with tabular figures. */

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const pct = value * 100;
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(digits)}%`;
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value >= 10_000) return `${(value / 1000).toFixed(1)} s`;
  return `${Math.round(value)} ms`;
}

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value === 0) return '$0';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 100) return `$${value.toFixed(2)}`;
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString('en-US');
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function formatRelative(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  if (Math.abs(seconds) < 45) return 'just now';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(Math.round(seconds / 60), 'minute');
}

/** 24-hour UTC clock time, e.g. "14:02:11". */
export function formatClock(iso: string | Date): string {
  return new Date(iso).toISOString().slice(11, 19);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

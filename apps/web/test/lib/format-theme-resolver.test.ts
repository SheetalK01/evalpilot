import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { safeNext } from '@/components/auth/forms';
import {
  formatClock,
  formatCount,
  formatMs,
  formatPercent,
  formatRelative,
  formatUsd,
  shortId,
} from '@/lib/format';
import { readChoice, resolveTheme, storeChoice } from '@/lib/theme';
import { toNested, zodResolver } from '@/lib/zod-resolver';

describe('format', () => {
  it.each([
    [formatPercent(0.9167), '91.7%'],
    [formatPercent(1), '100%'],
    [formatPercent(null), '—'],
    [formatMs(412.4), '412 ms'],
    [formatMs(15_000), '15.0 s'],
    [formatMs(null), '—'],
    [formatUsd(0), '$0'],
    [formatUsd(0.0042), '$0.0042'],
    [formatUsd(12.3), '$12.30'],
    [formatUsd(1234), '$1,234'],
    [formatCount(950), '950'],
    [formatCount(21_900), '21.9k'],
    [formatCount(2_500_000), '2.5M'],
    [formatClock('2026-10-26T14:02:11.500Z'), '14:02:11'],
    [shortId('cmvp61ifr0003boif25am22i7'), 'AM22I7'],
  ])('%s', (actual, expected) => {
    expect(actual).toBe(expected);
  });

  it('formats relative times', () => {
    const now = Date.parse('2026-10-26T12:00:00Z');
    expect(formatRelative('2026-10-26T11:59:40Z', now)).toBe('just now');
    expect(formatRelative('2026-10-26T11:00:00Z', now)).toBe('1 hour ago');
    expect(formatRelative('2026-10-25T12:00:00Z', now)).toBe('yesterday');
  });
});

describe('theme', () => {
  it('resolves system to the OS preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('remembers the choice and defaults to system', () => {
    localStorage.clear();
    expect(readChoice()).toBe('system');
    storeChoice('dark');
    expect(readChoice()).toBe('dark');
    localStorage.setItem('evalpilot-theme', 'neon');
    expect(readChoice()).toBe('system');
  });
});

describe('safeNext (no open redirects after login)', () => {
  it.each([
    ['/app/suites/s1', '/app/suites/s1'],
    [null, '/app'],
    ['https://evil.example', '/app'],
    ['//evil.example/app', '/app'],
    ['/login', '/app'],
  ])('%s → %s', (next, expected) => {
    expect(safeNext(next)).toBe(expected);
  });
});

describe('zodResolver', () => {
  const schema = z.object({
    name: z.string().min(1, 'Enter a name'),
    checks: z.array(z.object({ value: z.string().min(1, 'Required') })),
  });

  it('returns parsed values on success', async () => {
    const result = await zodResolver(schema)({ name: 'x', checks: [{ value: 'a' }] }, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    expect(result).toEqual({ values: { name: 'x', checks: [{ value: 'a' }] }, errors: {} });
  });

  it('returns nested field errors', async () => {
    const result = await zodResolver(schema)({ name: '', checks: [{ value: '' }] }, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    expect(result.errors).toMatchObject({
      name: { message: 'Enter a name' },
      checks: [{ value: { message: 'Required' } }],
    });
  });

  it('nests dotted paths into objects and arrays', () => {
    expect(toNested({ 'a.b': 1, 'list.0.x': 2 })).toEqual({ a: { b: 1 }, list: [{ x: 2 }] });
  });
});

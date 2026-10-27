import { describe, expect, it } from 'vitest';
import { compileSafeRegex, REGEX_MAX_INPUT_LENGTH, safeRegexTest } from '../src';

describe('compileSafeRegex', () => {
  it.each(['(a+)+', '(a*)*', '(\\w+\\s?)*$', '(x+){2,}', '(a|aa)+\\1+'])(
    'rejects catastrophic pattern %s',
    (pattern) => {
      const result = compileSafeRegex(pattern);
      expect(result.ok).toBe(false);
    },
  );

  it.each(['^\\d{3}-\\d{4}$', 'refund(s)?', '(?:foo|bar)+', '[a-z]+@[a-z]+\\.com'])(
    'accepts safe pattern %s',
    (pattern) => {
      expect(compileSafeRegex(pattern).ok).toBe(true);
    },
  );

  it('rejects stateful flags', () => {
    expect(compileSafeRegex('a', 'g')).toEqual({ ok: false, error: 'Flags g and y are not allowed' });
  });

  it('rejects overly long patterns', () => {
    expect(compileSafeRegex('a'.repeat(501)).ok).toBe(false);
  });

  it('reports invalid syntax', () => {
    const result = compileSafeRegex('(unclosed');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/^Invalid pattern/);
  });
});

describe('safeRegexTest', () => {
  it('only searches the first part of very long input', () => {
    const input = `${'a'.repeat(REGEX_MAX_INPUT_LENGTH)}NEEDLE`;
    expect(safeRegexTest('NEEDLE', undefined, input).matched).toBe(false);
    expect(safeRegexTest('NEEDLE', undefined, 'xx NEEDLE').matched).toBe(true);
  });

  it('finishes quickly on adversarial input for an accepted pattern', () => {
    const started = performance.now();
    safeRegexTest('^(?:a|b)+c$', undefined, 'ab'.repeat(5000));
    expect(performance.now() - started).toBeLessThan(500);
  });
});

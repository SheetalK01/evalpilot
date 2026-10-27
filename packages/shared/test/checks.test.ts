import { describe, expect, it } from 'vitest';
import {
  allChecksPassed,
  checksSchema,
  evaluateRuleCheck,
  evaluateRuleChecks,
  judgeCheckResult,
  type Check,
  type RuleCheck,
} from '../src';

const ctx = (output: string, latencyMs = 100) => ({ output, latencyMs });

describe('evaluateRuleCheck', () => {
  it.each<[string, RuleCheck, string, boolean]>([
    [
      'contains: case-insensitive by default',
      { type: 'contains', value: 'REFUND' },
      'You can get a refund.',
      true,
    ],
    [
      'contains: case-sensitive miss',
      { type: 'contains', value: 'REFUND', caseSensitive: true },
      'a refund',
      false,
    ],
    ['contains: missing value', { type: 'contains', value: '30 days' }, 'Within a month.', false],
    ['not_contains: absent', { type: 'not_contains', value: 'password' }, 'Hello', true],
    [
      'not_contains: present (any case)',
      { type: 'not_contains', value: 'password' },
      'Your PASSWORD is',
      false,
    ],
    [
      'not_contains: case-sensitive',
      { type: 'not_contains', value: 'Secret', caseSensitive: true },
      'secret',
      true,
    ],
    ['equals: trims both sides', { type: 'equals', value: ' 42 ' }, '42\n', true],
    ['equals: mismatch', { type: 'equals', value: 'yes' }, 'Yes', false],
    ['regex: match', { type: 'regex', pattern: 'order #\\d+' }, 'Your order #123 shipped', true],
    ['regex: flags', { type: 'regex', pattern: '^SHIPPED$', flags: 'im' }, 'status:\nshipped', true],
    ['regex: no match', { type: 'regex', pattern: '^\\d+$' }, 'abc', false],
    ['regex: catastrophic pattern rejected', { type: 'regex', pattern: '(a+)+$' }, 'aaaa', false],
    ['regex: invalid pattern fails safely', { type: 'regex', pattern: '([a-z' }, 'abc', false],
    [
      'json_schema: valid',
      { type: 'json_schema', schema: { type: 'object', required: ['ok'] } },
      '{"ok":true}',
      true,
    ],
    [
      'json_schema: fenced JSON accepted',
      { type: 'json_schema', schema: { type: 'array' } },
      '```json\n[1,2]\n```',
      true,
    ],
    ['json_schema: not JSON', { type: 'json_schema', schema: { type: 'object' } }, 'not json', false],
    [
      'json_schema: schema mismatch',
      { type: 'json_schema', schema: { type: 'object', required: ['id'] } },
      '{}',
      false,
    ],
    ['max_length: within', { type: 'max_length', chars: 5 }, 'hello', true],
    ['max_length: over', { type: 'max_length', chars: 4 }, 'hello', false],
    [
      'refusal expected: refused',
      { type: 'refusal', expected: true },
      "I'm sorry, but I can't help with that.",
      true,
    ],
    ['refusal expected: answered', { type: 'refusal', expected: true }, 'Sure, here you go.', false],
    ['refusal not expected: answered', { type: 'refusal', expected: false }, 'Refunds take 5 days.', true],
  ])('%s', (_name, check, output, passed) => {
    const result = evaluateRuleCheck(check, ctx(output));
    expect(result.type).toBe(check.type);
    expect(result.passed).toBe(passed);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('latency compares against the measured response time', () => {
    expect(evaluateRuleCheck({ type: 'latency', maxMs: 500 }, ctx('x', 499)).passed).toBe(true);
    expect(evaluateRuleCheck({ type: 'latency', maxMs: 500 }, ctx('x', 500)).passed).toBe(true);
    const slow = evaluateRuleCheck({ type: 'latency', maxMs: 500 }, ctx('x', 501));
    expect(slow.passed).toBe(false);
    expect(slow.message).toBe('501 ms (limit 500 ms)');
  });

  it('truncates long values in messages', () => {
    const value = 'x'.repeat(100);
    expect(evaluateRuleCheck({ type: 'contains', value }, ctx('nope')).message).toContain('…');
  });
});

describe('evaluateRuleChecks', () => {
  it('evaluates rule checks and returns judge checks separately', () => {
    const checks: Check[] = [
      { type: 'contains', value: 'refund' },
      { type: 'llm_judge', criteria: 'Mentions the 30 day refund window', threshold: 7 },
      { type: 'max_length', chars: 200 },
    ];
    const { results, judgeChecks } = evaluateRuleChecks(checks, ctx('Refunds within 30 days.'));
    expect(results.map((r) => r.type)).toEqual(['contains', 'max_length']);
    expect(judgeChecks).toHaveLength(1);
    expect(judgeChecks[0]?.threshold).toBe(7);
  });
});

describe('judgeCheckResult', () => {
  const check = { type: 'llm_judge', criteria: 'polite', threshold: 7 } as const;

  it('passes at or above the threshold and records the mode', () => {
    const result = judgeCheckResult(check, { score: 7, reason: 'Good' }, 'mock');
    expect(result).toMatchObject({ passed: true, score: 7, mode: 'mock' });
    expect(result.message).toContain('Score 7/10');
  });

  it('fails below the threshold', () => {
    expect(judgeCheckResult(check, { score: 6, reason: 'Meh' }, 'live').passed).toBe(false);
  });
});

describe('allChecksPassed', () => {
  it('requires every check to pass', () => {
    expect(allChecksPassed([{ type: 'contains', passed: true, message: '' }])).toBe(true);
    expect(
      allChecksPassed([
        { type: 'contains', passed: true, message: '' },
        { type: 'equals', passed: false, message: '' },
      ]),
    ).toBe(false);
  });

  it('treats an empty list as not passed', () => {
    expect(allChecksPassed([])).toBe(false);
  });
});

describe('checksSchema', () => {
  it('accepts every check type', () => {
    const parsed = checksSchema.safeParse([
      { type: 'contains', value: 'a' },
      { type: 'not_contains', value: 'b' },
      { type: 'equals', value: 'c' },
      { type: 'regex', pattern: 'd', flags: 'i' },
      { type: 'json_schema', schema: { type: 'object' } },
      { type: 'max_length', chars: 10 },
      { type: 'latency', maxMs: 1000 },
      { type: 'refusal', expected: true },
      { type: 'llm_judge', criteria: 'is helpful', threshold: 8 },
    ]);
    expect(parsed.success).toBe(true);
  });

  it.each([
    ['empty list', []],
    ['unknown type', [{ type: 'magic' }]],
    ['stateful regex flag', [{ type: 'regex', pattern: 'a', flags: 'g' }]],
    ['judge threshold out of range', [{ type: 'llm_judge', criteria: 'abc', threshold: 11 }]],
    ['negative max length', [{ type: 'max_length', chars: -1 }]],
    ['too many checks', Array.from({ length: 21 }, () => ({ type: 'contains', value: 'a' }))],
  ])('rejects %s', (_name, value) => {
    expect(checksSchema.safeParse(value).success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  diffRuns,
  estimateCostUsd,
  estimateTokens,
  isKnownModel,
  percentile,
  runVerdict,
  summarizeResults,
} from '../src';

describe('estimateCostUsd', () => {
  it('uses per-million-token prices', () => {
    // 1M input * $4 + 1M output * $20
    expect(estimateCostUsd('claude-opus-5-5', 1_000_000, 1_000_000)).toBe(24);
    expect(estimateCostUsd('claude-haiku-5-5', 2000, 1000)).toBe(0.0007);
  });

  it('rounds to 6 decimals', () => {
    expect(estimateCostUsd('claude-sonnet-5-5', 1, 1)).toBe(0.000012);
  });

  it('returns 0 for unknown or missing models and ignores negative tokens', () => {
    expect(estimateCostUsd('gpt-9', 1000, 1000)).toBe(0);
    expect(estimateCostUsd(undefined, 1000, 1000)).toBe(0);
    expect(estimateCostUsd('claude-opus-5-5', -5, 0)).toBe(0);
  });

  it('knows which models it can price', () => {
    expect(isKnownModel('claude-opus-5-5')).toBe(true);
    expect(isKnownModel('other')).toBe(false);
    expect(isKnownModel(null)).toBe(false);
  });

  it('estimates tokens at ~4 characters each', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcde')).toBe(2);
  });
});

describe('percentile', () => {
  it('uses nearest rank', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile(values, 50)).toBe(50);
    expect(percentile([5, 1, 3], 100)).toBe(5);
    expect(percentile([5, 1, 3], 0)).toBe(1);
  });

  it('returns null for an empty list', () => {
    expect(percentile([], 95)).toBeNull();
  });
});

describe('summarizeResults', () => {
  it('computes counts, pass rate, average latency and tokens', () => {
    const summary = summarizeResults([
      { status: 'PASSED', latencyMs: 100, tokens: 10 },
      { status: 'PASSED', latencyMs: 300, tokens: 20 },
      { status: 'FAILED', latencyMs: 200, tokens: 5 },
      { status: 'ERROR', latencyMs: null, tokens: 0 },
    ]);
    expect(summary).toEqual({
      total: 4,
      passed: 2,
      failed: 2,
      errored: 1,
      passRate: 0.5,
      avgLatencyMs: 200,
      totalTokens: 35,
    });
  });

  it('handles an empty run', () => {
    expect(summarizeResults([])).toMatchObject({ total: 0, passRate: null, avgLatencyMs: null });
  });

  it('rounds the pass rate to 4 decimals', () => {
    const results = [
      { status: 'PASSED' as const, latencyMs: 1, tokens: 0 },
      ...Array.from({ length: 2 }, () => ({ status: 'FAILED' as const, latencyMs: 1, tokens: 0 })),
    ];
    expect(summarizeResults(results).passRate).toBe(0.3333);
  });
});

describe('runVerdict', () => {
  it.each([
    [0.9, 0.9, 'PASSED'],
    [0.95, 0.9, 'PASSED'],
    [0.89, 0.9, 'FAILED'],
    [null, 0, 'FAILED'],
  ] as const)('pass rate %s with threshold %s is %s', (rate, threshold, verdict) => {
    expect(runVerdict(rate, threshold)).toBe(verdict);
  });
});

describe('diffRuns', () => {
  it('classifies changes and lists regressions first', () => {
    const diff = diffRuns(
      [
        { testCaseId: 'a', caseName: 'A', status: 'PASSED' },
        { testCaseId: 'b', caseName: 'B', status: 'FAILED' },
        { testCaseId: 'c', caseName: 'C', status: 'PASSED' },
        { testCaseId: 'gone', caseName: 'Gone', status: 'PASSED' },
      ],
      [
        { testCaseId: 'c', caseName: 'C', status: 'PASSED' },
        { testCaseId: 'b', caseName: 'B', status: 'PASSED' },
        { testCaseId: 'a', caseName: 'A', status: 'ERROR' },
        { testCaseId: 'new', caseName: 'New', status: 'FAILED' },
      ],
    );
    expect(diff.cases.map((c) => [c.caseName, c.change])).toEqual([
      ['A', 'PASS_TO_FAIL'],
      ['B', 'FAIL_TO_PASS'],
      ['New', 'ADDED'],
      ['Gone', 'REMOVED'],
      ['C', 'UNCHANGED'],
    ]);
    expect(diff.regressions).toBe(1);
    expect(diff.fixes).toBe(1);
  });

  it('matches deleted cases by name', () => {
    const diff = diffRuns(
      [{ testCaseId: null, caseName: 'Old', status: 'PASSED' }],
      [{ testCaseId: null, caseName: 'Old', status: 'FAILED' }],
    );
    expect(diff.cases[0]).toMatchObject({ key: 'name:Old', change: 'PASS_TO_FAIL' });
  });
});

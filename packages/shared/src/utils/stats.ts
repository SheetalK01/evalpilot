import type { ResultStatus, RunStatus } from '../enums';

/** Nearest-rank percentile (p in 0–100). Returns null for an empty list. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((Math.min(100, Math.max(0, p)) / 100) * sorted.length);
  return sorted[Math.max(0, rank - 1)] ?? null;
}

export interface ResultForSummary {
  status: ResultStatus;
  latencyMs: number | null;
  tokens: number;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  errored: number;
  /** 0–1, rounded to 4 decimals; null when there are no results. */
  passRate: number | null;
  avgLatencyMs: number | null;
  totalTokens: number;
}

export function summarizeResults(results: readonly ResultForSummary[]): RunSummary {
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const errored = results.filter((r) => r.status === 'ERROR').length;
  const latencies = results.map((r) => r.latencyMs).filter((ms): ms is number => ms !== null);
  return {
    total: results.length,
    passed,
    // Errors count as failures for the pass rate and the run verdict.
    failed: results.length - passed,
    errored,
    passRate: results.length === 0 ? null : Math.round((passed / results.length) * 10_000) / 10_000,
    avgLatencyMs:
      latencies.length === 0 ? null : Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    totalTokens: results.reduce((sum, r) => sum + r.tokens, 0),
  };
}

/** A finished run passes when its pass rate reaches the suite's threshold. */
export function runVerdict(
  passRate: number | null,
  threshold: number,
): Extract<RunStatus, 'PASSED' | 'FAILED'> {
  return passRate !== null && passRate >= threshold ? 'PASSED' : 'FAILED';
}

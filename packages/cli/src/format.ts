import type { CliResult, CliRun } from './types';

export interface Colors {
  green: (text: string) => string;
  red: (text: string) => string;
  yellow: (text: string) => string;
  dim: (text: string) => string;
  bold: (text: string) => string;
}

const ansi = (code: number) => (text: string) => `\u001b[${code}m${text}\u001b[0m`;
export const COLORS: Colors = {
  green: ansi(32),
  red: ansi(31),
  yellow: ansi(33),
  dim: ansi(2),
  bold: ansi(1),
};
export const NO_COLORS: Colors = {
  green: (t) => t,
  red: (t) => t,
  yellow: (t) => t,
  dim: (t) => t,
  bold: (t) => t,
};

const pct = (value: number | null) =>
  value === null ? '—' : `${(value * 100).toFixed(1).replace(/\.0$/, '')}%`;
const fit = (text: string, width: number) =>
  text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width);

function failedChecks(result: CliResult): string {
  if (result.error) return result.error;
  return result.checkResults
    .filter((check) => !check.passed)
    .map((check) => `${check.type}: ${check.message}`)
    .join('; ');
}

/** The results as an aligned text table (no box-drawing, so it reads well in any CI log). */
export function resultsTable(results: readonly CliResult[], colors: Colors): string {
  const rows = [...results].sort((a, b) => a.position - b.position);
  const nameWidth = Math.min(40, Math.max(4, ...rows.map((r) => r.caseName.length)));
  const status = (s: CliResult['status']) =>
    s === 'PASSED' ? colors.green('PASS  ') : s === 'FAILED' ? colors.red('FAIL  ') : colors.yellow('ERROR ');
  const header = colors.dim(`${'CASE'.padEnd(nameWidth)}  STATUS  ${'LATENCY'.padStart(8)}  DETAILS`);
  const lines = rows.map((r) => {
    const latency = r.latencyMs === null ? '—' : `${r.latencyMs} ms`;
    return `${fit(r.caseName, nameWidth)}  ${status(r.status)}  ${latency.padStart(8)}  ${colors.dim(fit(failedChecks(r), 60).trimEnd())}`;
  });
  return [header, ...lines].join('\n');
}

export function verdictLine(run: CliRun, threshold: number, passed: boolean, colors: Colors): string {
  const verdict = passed ? colors.green(colors.bold('✓ PASSED')) : colors.red(colors.bold('✗ FAILED'));
  return `Pass rate ${colors.bold(pct(run.passRate))} (${run.passed}/${run.total}) · threshold ${pct(threshold)} · ${verdict}`;
}

export interface JsonSummary {
  runId: string;
  suite: string;
  status: CliRun['status'];
  passRate: number | null;
  threshold: number;
  passed: boolean;
  total: number;
  failedCases: { name: string; status: CliResult['status']; details: string }[];
}

export function jsonSummary(run: CliRun, threshold: number, passed: boolean): JsonSummary {
  return {
    runId: run.id,
    suite: run.suiteName,
    status: run.status,
    passRate: run.passRate,
    threshold,
    passed,
    total: run.total,
    failedCases: run.results
      .filter((r) => r.status !== 'PASSED')
      .map((r) => ({ name: r.caseName, status: r.status, details: failedChecks(r) })),
  };
}

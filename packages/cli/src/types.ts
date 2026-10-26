/** The parts of the API responses the CLI uses (kept in sync with @evalpilot/shared; see test). */
export type RunStatus = 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'CANCELLED';
export type ResultStatus = 'PASSED' | 'FAILED' | 'ERROR';

export interface CliCheckResult {
  type: string;
  passed: boolean;
  message: string;
}

export interface CliResult {
  caseName: string;
  position: number;
  status: ResultStatus;
  latencyMs: number | null;
  checkResults: CliCheckResult[];
  error: string | null;
}

export interface CliRun {
  id: string;
  suiteId: string;
  suiteName: string;
  status: RunStatus;
  total: number;
  passed: number;
  failed: number;
  passRate: number | null;
  passThreshold: number;
  commitSha: string | null;
  error: string | null;
  results: CliResult[];
}

export const FINAL_STATUSES: readonly RunStatus[] = ['PASSED', 'FAILED', 'ERROR', 'CANCELLED'];

export const EXIT = {
  /** Pass rate met the threshold. */
  passed: 0,
  /** The run finished but quality is below the threshold. */
  belowThreshold: 1,
  /** The gate could not decide: bad usage, API error, run error or timeout. */
  error: 2,
} as const;

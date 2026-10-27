import type { AttackCategory, PingResultResponse } from '@evalpilot/shared';

export const QUEUE_NAMES = {
  testRuns: 'test-runs',
  redteam: 'redteam',
  targetPing: 'target-ping',
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface TestRunJob {
  runId: string;
}

export interface RedteamJob {
  redteamRunId: string;
  /** Attack categories to run; all when omitted. */
  categories?: AttackCategory[];
}

export interface PingJob {
  targetId: string;
}

export type PingJobResult = PingResultResponse;

/** Runs are not retried as a whole: the worker records per-case errors and marks broken runs ERROR. */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 1,
  removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
} as const;

import type { RunStatus as SharedRunStatus, TestResultResponse, V1RunResponse } from '@evalpilot/shared';
import { describe, expectTypeOf, it } from 'vitest';
import type { CliResult, CliRun, RunStatus } from '../src/types';

describe('CLI types are a subset of the API contract in @evalpilot/shared', () => {
  it('accepts what GET /v1/runs/:id returns', () => {
    expectTypeOf<RunStatus>().toEqualTypeOf<SharedRunStatus>();
    expectTypeOf<V1RunResponse>().toExtend<CliRun>();
    expectTypeOf<TestResultResponse>().toExtend<CliResult>();
  });
});

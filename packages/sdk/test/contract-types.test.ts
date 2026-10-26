import {
  TRACE_BATCH_MAX as SHARED_BATCH_MAX,
  TRACE_TEXT_MAX as SHARED_TEXT_MAX,
  traceInputSchema,
  type TraceInput as SharedTraceInput,
} from '@evalpilot/shared';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { TRACE_BATCH_MAX, TRACE_TEXT_MAX, type TraceInput } from '../src';

describe('SDK types match the API contract in @evalpilot/shared', () => {
  it('uses the same limits', () => {
    expect(TRACE_BATCH_MAX).toBe(SHARED_BATCH_MAX);
    expect(TRACE_TEXT_MAX).toBe(SHARED_TEXT_MAX);
  });

  it('TraceInput is the same shape as the API schema input', () => {
    expectTypeOf<TraceInput>().toEqualTypeOf<SharedTraceInput>();
  });

  it('a full SDK trace passes the API schema', () => {
    const trace: TraceInput = {
      externalId: 'x',
      name: 'shopbot.chat',
      input: 'hi',
      output: 'hello',
      model: 'claude-opus-5-5',
      latencyMs: 12,
      inputTokens: 3,
      outputTokens: 2,
      status: 'OK',
      metadata: { sessionId: 's1', vip: true, retries: 0, note: null },
      startedAt: new Date().toISOString(),
    };
    expect(traceInputSchema.safeParse(trace).success).toBe(true);
  });
});

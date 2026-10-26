import type { Target } from '@prisma/client';
import type { Check } from '@evalpilot/shared';
import type { Judge } from '../judge/judge';
import { MockJudge } from '../judge/mock-judge';
import { TargetCallError } from '../target/target-client';
import { evaluateCase } from './case-evaluator';

const target = { id: 't' } as Target;
const answer =
  (output: string, latencyMs = 100) =>
  () =>
    Promise.resolve({
      output,
      latencyMs,
      usage: { model: 'claude-haiku-5-5', inputTokens: 1000, outputTokens: 500, reported: true },
    });

const liveJudge = (overrides: Partial<Judge> = {}): Judge => ({
  mode: 'live',
  score: () =>
    Promise.resolve({
      score: 8,
      reason: 'Good.',
      usage: { model: 'claude-opus-5-5', inputTokens: 1000, outputTokens: 100 },
    }),
  classifyRefusal: () =>
    Promise.resolve({
      refused: true,
      reason: 'Declined.',
      usage: { model: 'claude-opus-5-5', inputTokens: 500, outputTokens: 50 },
    }),
  assessAttack: () => Promise.resolve({ vulnerable: false, reason: 'x', usage: null }),
  ...overrides,
});

describe('evaluateCase', () => {
  it('passes when every check passes, and counts tokens and cost', async () => {
    const checks: Check[] = [
      { type: 'contains', value: '30 days' },
      { type: 'latency', maxMs: 200 },
    ];
    const outcome = await evaluateCase(target, { input: 'refund?' }, checks, {
      call: answer('Within 30 days.'),
      judge: new MockJudge(),
    });
    expect(outcome).toMatchObject({
      status: 'PASSED',
      output: 'Within 30 days.',
      latencyMs: 100,
      tokens: 1500,
      error: null,
      judgeScore: null,
    });
    expect(outcome.estCostUsd).toBe(0.00035); // haiku 5.5: 1000 × $0.10 + 500 × $0.50 per MTok
    expect(outcome.checkResults).toHaveLength(2);
  });

  it('fails when any check fails', async () => {
    const outcome = await evaluateCase(target, { input: 'x' }, [{ type: 'contains', value: 'nope' }], {
      call: answer('hello'),
      judge: new MockJudge(),
    });
    expect(outcome.status).toBe('FAILED');
  });

  it('turns a target failure into an ERROR result', async () => {
    const outcome = await evaluateCase(target, { input: 'x' }, [{ type: 'contains', value: 'a' }], {
      call: () => Promise.reject(new TargetCallError('Timed out after 1000 ms', 1000)),
      judge: new MockJudge(),
    });
    expect(outcome).toMatchObject({
      status: 'ERROR',
      error: 'Timed out after 1000 ms',
      latencyMs: 1000,
      output: null,
      checkResults: [],
    });
  });

  it('rethrows unexpected errors', async () => {
    await expect(
      evaluateCase(target, { input: 'x' }, [], {
        call: () => Promise.reject(new Error('bug')),
        judge: new MockJudge(),
      }),
    ).rejects.toThrow('bug');
  });

  it('uses the judge for llm_judge checks and keeps the lowest score', async () => {
    const judge = liveJudge({
      score: jest
        .fn()
        .mockResolvedValueOnce({ score: 9, reason: 'Polite.', usage: null })
        .mockResolvedValueOnce({ score: 5, reason: 'No refund window.', usage: null }),
    });
    const checks: Check[] = [
      { type: 'llm_judge', criteria: 'Polite', threshold: 7 },
      { type: 'llm_judge', criteria: 'Mentions refund window', threshold: 7 },
    ];
    const outcome = await evaluateCase(target, { input: 'x' }, checks, { call: answer('Hello!'), judge });
    expect(outcome).toMatchObject({
      status: 'FAILED',
      judgeScore: 5,
      judgeReason: 'Polite. No refund window.',
    });
    expect(outcome.checkResults.map((c) => [c.passed, c.mode])).toEqual([
      [true, 'live'],
      [false, 'live'],
    ]);
  });

  it('asks the LLM about refusals in live mode and adds its cost', async () => {
    const checks: Check[] = [
      { type: 'contains', value: 'sorry' },
      { type: 'refusal', expected: true },
    ];
    // The heuristic would say "answered" for this text; the live judge says it is a refusal.
    const outcome = await evaluateCase(target, { input: 'give me data' }, checks, {
      call: answer('sorry, that is private'),
      judge: liveJudge(),
    });
    expect(outcome.status).toBe('PASSED');
    expect(outcome.checkResults[1]).toMatchObject({ type: 'refusal', passed: true, mode: 'live' });
    expect(outcome.tokens).toBe(1500 + 550);
  });

  it('reports a judge failure as ERROR but keeps the output', async () => {
    const judge = liveJudge({ score: () => Promise.reject(new Error('rate limited')) });
    const outcome = await evaluateCase(
      target,
      { input: 'x' },
      [{ type: 'llm_judge', criteria: 'abc', threshold: 5 }],
      { call: answer('hi'), judge },
    );
    expect(outcome).toMatchObject({ status: 'ERROR', output: 'hi', error: 'Judge failed: rate limited' });
  });
});

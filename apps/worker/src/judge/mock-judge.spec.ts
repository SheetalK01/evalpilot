import type { AppConfig } from '@evalpilot/server-core';
import { AnthropicJudge } from './anthropic-judge';
import { createJudge } from './judge.module';
import { MockJudge } from './mock-judge';

describe('MockJudge', () => {
  const judge = new MockJudge();

  it('is deterministic and labelled', async () => {
    const verdict = await judge.score({ criteria: 'refund window', output: 'The refund window is 30 days' });
    expect(verdict).toEqual({ score: 10, reason: expect.stringContaining('[mock]'), usage: null });
  });

  it('uses the refusal heuristic and leaves attacks to the detection rules', async () => {
    await expect(
      judge.classifyRefusal({ output: "I'm sorry, I can't help with that." }),
    ).resolves.toMatchObject({ refused: true });
    await expect(judge.assessAttack()).resolves.toMatchObject({ vulnerable: false });
  });
});

describe('createJudge', () => {
  const config = (aiMode: 'mock' | 'live', apiKey: string | null) =>
    ({ aiMode, anthropic: { apiKey, model: 'claude-opus-5-5', judgeEffort: 'low' } }) as AppConfig;

  it('picks the judge from AI_MODE', () => {
    expect(createJudge(config('mock', null))).toBeInstanceOf(MockJudge);
    expect(createJudge(config('live', 'sk-ant-test'))).toBeInstanceOf(AnthropicJudge);
    expect(() => createJudge(config('live', null))).toThrow('ANTHROPIC_API_KEY');
  });
});

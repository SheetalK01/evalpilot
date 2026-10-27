import type Anthropic from '@anthropic-ai/sdk';
import { AnthropicJudge } from './anthropic-judge';
import { JudgeError } from './judge';

function fakeClient(response: object) {
  const parse = jest.fn().mockResolvedValue({
    stop_reason: 'end_turn',
    usage: { input_tokens: 300, output_tokens: 40 },
    ...response,
  });
  return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse };
}

const judgeWith = (response: object, model = 'claude-opus-5-5') => {
  const { client, parse } = fakeClient(response);
  return { judge: new AnthropicJudge({ apiKey: 'sk-test', model, effort: 'medium', client }), parse };
};

describe('AnthropicJudge', () => {
  it('scores with structured output, clamps the score and reports usage', async () => {
    const { judge, parse } = judgeWith({ parsed_output: { score: 12.4, reason: ' Great answer. ' } });
    const verdict = await judge.score({ criteria: 'Mentions 30 days', prompt: 'refund?', output: '30 days' });
    expect(verdict).toEqual({
      score: 10,
      reason: 'Great answer.',
      usage: { model: 'claude-opus-5-5', inputTokens: 300, outputTokens: 40 },
    });

    const request = parse.mock.calls[0][0];
    expect(request).toMatchObject({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
    });
    expect(request).not.toHaveProperty('thinking'); // adaptive by default on Opus 5.5
    expect(request.output_config.format).toBeDefined();
    expect(request.messages[0].content).toContain('<assistant_answer>');
  });

  it('only asks for fallbacks on models that support them', async () => {
    const { judge, parse } = judgeWith({ parsed_output: { score: 1, reason: 'x' } }, 'claude-haiku-5-5');
    await judge.score({ criteria: 'c', prompt: 'p', output: 'o' });
    expect(parse.mock.calls[0][0]).not.toHaveProperty('fallbacks');
    expect(parse.mock.calls[0][0]).not.toHaveProperty('betas');
  });

  it('classifies refusals and attacks', async () => {
    await expect(
      judgeWith({ parsed_output: { refused: true, reason: 'Declined.' } }).judge.classifyRefusal({
        prompt: 'p',
        output: 'no',
      }),
    ).resolves.toMatchObject({ refused: true });
    await expect(
      judgeWith({
        parsed_output: { attack_succeeded: true, reason: 'Leaked the prompt.' },
      }).judge.assessAttack({ category: 'SYSTEM_PROMPT_LEAK', attackName: 'x', prompt: 'p', output: 'o' }),
    ).resolves.toMatchObject({ vulnerable: true, reason: 'Leaked the prompt.' });
  });

  it.each([
    [{ stop_reason: 'refusal', parsed_output: null }, 'The judge model declined to grade this answer'],
    [{ stop_reason: 'max_tokens', parsed_output: null }, 'The judge ran out of tokens before answering'],
    [{ parsed_output: null }, 'The judge returned an answer that did not match the schema'],
  ])('turns %p into a JudgeError', async (response, message) => {
    await expect(
      judgeWith(response).judge.score({ criteria: 'c', prompt: 'p', output: 'o' }),
    ).rejects.toThrow(new JudgeError(message));
  });
});

import { describe, expect, it } from 'vitest';
import { extractUsage } from '../src';

describe('extractUsage', () => {
  it('reads Anthropic-style usage and the model', () => {
    expect(
      extractUsage(
        { model: 'claude-opus-5-5', usage: { input_tokens: 120, output_tokens: 45 } },
        'in',
        'out',
      ),
    ).toEqual({
      model: 'claude-opus-5-5',
      inputTokens: 120,
      outputTokens: 45,
      reported: true,
    });
  });

  it('reads OpenAI-style usage', () => {
    expect(extractUsage({ usage: { prompt_tokens: 10, completion_tokens: 5 } }, 'in', 'out')).toMatchObject({
      inputTokens: 10,
      outputTokens: 5,
      reported: true,
    });
  });

  it('estimates when usage is missing or invalid', () => {
    expect(extractUsage('plain text', 'abcdefgh', 'abcd')).toEqual({
      model: null,
      inputTokens: 2,
      outputTokens: 1,
      reported: false,
    });
    expect(extractUsage({ usage: { input_tokens: -1, output_tokens: 'x' }, model: 42 }, 'abcd', '')).toEqual({
      model: null,
      inputTokens: 1,
      outputTokens: 0,
      reported: false,
    });
  });
});

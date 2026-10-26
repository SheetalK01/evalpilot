import type Anthropic from '@anthropic-ai/sdk';
import { SHOPBOT_CANARY } from '@evalpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { ClaudeBrain, createBrain, MockBrain } from '../src/brain';
import { loadShopBotConfig } from '../src/config';
import { REFUSAL } from '../src/mock-brain';

describe('MockBrain', () => {
  it('answers after a simulated delay with estimated tokens', async () => {
    const delay = vi.fn(() => Promise.resolve());
    const answer = await new MockBrain('v1', 'claude-opus-5-5', delay).answer('Can I return it?');
    expect(delay).toHaveBeenCalledOnce();
    expect(answer).toMatchObject({ model: 'claude-opus-5-5', reply: expect.stringContaining('30 days') });
    expect(answer.inputTokens).toBeGreaterThan(50);
    expect(answer.outputTokens).toBeGreaterThan(0);
  });
});

describe('ClaudeBrain', () => {
  const clientReturning = (response: object) => {
    const create = vi.fn().mockResolvedValue({
      stop_reason: 'end_turn',
      usage: { input_tokens: 210, output_tokens: 34 },
      ...response,
    });
    return { client: { messages: { create } } as unknown as Pick<Anthropic, 'messages'>, create };
  };

  it('sends the system prompt (with canary) at low effort and returns the text', async () => {
    const { client, create } = clientReturning({
      content: [
        { type: 'text', text: 'Hi! ' },
        { type: 'text', text: 'How can I help?' },
      ],
    });
    const answer = await new ClaudeBrain('v1', 'claude-opus-5-5', client).answer('hello');
    expect(answer).toEqual({
      reply: 'Hi! How can I help?',
      model: 'claude-opus-5-5',
      inputTokens: 210,
      outputTokens: 34,
    });
    const request = create.mock.calls[0]![0];
    expect(request).toMatchObject({
      model: 'claude-opus-5-5',
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(request.system).toContain(SHOPBOT_CANARY);
    expect(request).not.toHaveProperty('thinking');
  });

  it('answers with a polite refusal when the model declines or returns nothing', async () => {
    for (const response of [
      { stop_reason: 'refusal', content: [] },
      { content: [{ type: 'thinking', thinking: '' }] },
    ]) {
      const { client } = clientReturning(response);
      expect((await new ClaudeBrain('v1', 'm', client).answer('x')).reply).toBe(REFUSAL);
    }
  });
});

describe('config and brain selection', () => {
  it('defaults to mock mode on port 4100 with prompt v1', () => {
    expect(loadShopBotConfig({})).toMatchObject({
      port: 4100,
      aiMode: 'mock',
      promptVersion: 'v1',
      model: 'claude-opus-5-5',
      evalpilot: { apiKey: null },
    });
  });

  it('requires an Anthropic key in live mode', () => {
    expect(() => loadShopBotConfig({ AI_MODE: 'live' })).toThrow('AI_MODE=live needs ANTHROPIC_API_KEY');
  });

  it('creates the right brain', () => {
    expect(createBrain(loadShopBotConfig({}))).toBeInstanceOf(MockBrain);
    expect(
      createBrain(loadShopBotConfig({ AI_MODE: 'live', ANTHROPIC_API_KEY: 'sk-ant-test' })),
    ).toBeInstanceOf(ClaudeBrain);
  });
});

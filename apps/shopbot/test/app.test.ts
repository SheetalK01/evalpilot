import { describe, expect, it, vi } from 'vitest';
import { buildApp, createTracer } from '../src/app';
import type { Brain } from '../src/brain';
import { loadShopBotConfig } from '../src/config';

const config = { ...loadShopBotConfig({}), logLevel: 'silent' as const };
const brain: Brain = {
  mode: 'mock',
  answer: (message) =>
    Promise.resolve({
      reply: `echo: ${message}`,
      model: 'claude-opus-5-5',
      inputTokens: 100,
      outputTokens: 7,
    }),
};

describe('ShopBot HTTP API', () => {
  it('answers POST /chat with the reply, model and Anthropic-style usage', async () => {
    const app = buildApp({ config, brain });
    const res = await app.inject({ method: 'POST', url: '/chat', payload: { message: 'Hi' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      reply: 'echo: Hi',
      model: 'claude-opus-5-5',
      mode: 'mock',
      promptVersion: 'v1',
      usage: { input_tokens: 100, output_tokens: 7 },
    });
    await app.close();
  });

  it.each([
    [{}, 'message: Invalid input'],
    [{ message: '   ' }, 'message: message is required'],
    [{ message: 'x'.repeat(4001) }, 'message: Too big'],
  ])('rejects %j with 400', async (payload, error) => {
    const app = buildApp({ config, brain });
    const res = await app.inject({ method: 'POST', url: '/chat', payload });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain(error.split(':')[0]);
    await app.close();
  });

  it('traces every chat through the SDK and flushes on close', async () => {
    const trace = vi.fn(
      (_name: string, _meta: object, fn: () => Promise<unknown>, _describe: (r: object) => object) => fn(),
    );
    const shutdown = vi.fn(() => Promise.resolve());
    const app = buildApp({ config, brain, tracer: { trace, shutdown } as never });
    await app.inject({
      method: 'POST',
      url: '/chat',
      payload: { message: 'Where is my order?', sessionId: 's-42' },
    });
    expect(trace).toHaveBeenCalledWith(
      'shopbot.chat',
      {
        input: 'Where is my order?',
        model: 'claude-opus-5-5',
        metadata: { promptVersion: 'v1', mode: 'mock', sessionId: 's-42' },
      },
      expect.any(Function),
      expect.any(Function),
    );
    const describe = trace.mock.calls[0]![3];
    expect(describe({ reply: 'r', model: 'm', inputTokens: 1, outputTokens: 2 })).toEqual({
      output: 'r',
      model: 'm',
      inputTokens: 1,
      outputTokens: 2,
    });
    await app.close();
    expect(shutdown).toHaveBeenCalledOnce();
  });

  it('reports health', async () => {
    const app = buildApp({ config, brain });
    expect((await app.inject({ method: 'GET', url: '/health' })).json()).toEqual({
      status: 'ok',
      mode: 'mock',
      promptVersion: 'v1',
    });
    await app.close();
  });

  it('only creates a tracer when an EvalPilot API key is set', async () => {
    expect(createTracer(config)).toBeUndefined();
    const tracer = createTracer({
      ...config,
      evalpilot: { apiKey: 'ep_live_x', url: 'http://localhost:4000' },
    });
    expect(tracer).toBeDefined();
    await tracer?.shutdown();
  });
});

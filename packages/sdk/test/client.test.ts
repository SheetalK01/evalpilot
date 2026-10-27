import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EvalPilot, type EvalPilotError, normalizeBaseUrl, TRACE_TEXT_MAX, type TraceInput } from '../src';

interface Sent {
  url: string;
  headers: Record<string, string>;
  traces: TraceInput[];
}

const urlOf = (url: string | URL | Request) =>
  typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;

/** A fake fetch that records requests and answers with the given statuses in order. */
function fakeFetch(statuses: (number | 'network')[] = [], headers: Record<string, string> = {}) {
  const sent: Sent[] = [];
  let call = 0;
  const impl = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const status = statuses[call++] ?? 202;
    sent.push({
      url: urlOf(url),
      headers: init?.headers as Record<string, string>,
      traces: (JSON.parse(init?.body as string) as { traces: TraceInput[] }).traces,
    });
    if (status === 'network') return Promise.reject(new TypeError('fetch failed'));
    return Promise.resolve(new Response(null, { status, headers }));
  });
  return { impl: impl as unknown as typeof fetch, sent };
}

const client = (
  fetch: typeof globalThis.fetch,
  options: Partial<ConstructorParameters<typeof EvalPilot>[0]> = {},
) =>
  new EvalPilot({
    apiKey: 'ep_live_test',
    baseUrl: 'http://api.test',
    fetch,
    retryBaseMs: 1,
    flushIntervalMs: 60_000,
    onError: () => undefined,
    ...options,
  });

describe('EvalPilot.trace', () => {
  it('returns the result and records a trace with timing, output and metadata', async () => {
    const { impl, sent } = fakeFetch();
    const ep = client(impl);
    const answer = await ep.trace(
      'shopbot.chat',
      { input: 'Where is my order?', model: 'claude-opus-5-5', metadata: { sessionId: 's1' } },
      () => Promise.resolve('It ships tomorrow'),
    );
    expect(answer).toBe('It ships tomorrow');
    await ep.flush();

    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe('http://api.test/api/v1/traces');
    expect(sent[0]?.headers.authorization).toBe('Bearer ep_live_test');
    const [trace] = sent[0]!.traces;
    expect(trace).toMatchObject({
      name: 'shopbot.chat',
      input: 'Where is my order?',
      output: 'It ships tomorrow',
      model: 'claude-opus-5-5',
      status: 'OK',
      metadata: { sessionId: 's1' },
    });
    expect(trace?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(trace?.externalId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(trace!.startedAt!)).not.toBeNaN();
  });

  it('records the error and rethrows the original error unchanged', async () => {
    const { impl, sent } = fakeFetch();
    const ep = client(impl);
    const original = new Error('Model overloaded');
    await expect(ep.trace('shopbot.chat', { model: 'm' }, () => Promise.reject(original))).rejects.toBe(
      original,
    );
    await ep.flush();
    expect(sent[0]?.traces[0]).toMatchObject({ status: 'ERROR', error: 'Model overloaded', model: 'm' });
  });

  it('uses `describe` for structured results and serialises objects by default', async () => {
    const { impl, sent } = fakeFetch();
    const ep = client(impl);
    await ep.trace(
      'a',
      {},
      () => ({ text: 'hi', usage: { in: 10, out: 4 } }),
      (r) => ({
        output: r.text,
        inputTokens: r.usage.in,
        outputTokens: r.usage.out,
        model: 'claude-haiku-5-5',
      }),
    );
    await ep.trace('b', {}, () => ({ ok: true }));
    await ep.trace('c', {}, () => undefined);
    await ep.flush();
    expect(sent[0]?.traces.map((t) => [t.output, t.inputTokens, t.model])).toEqual([
      ['hi', 10, 'claude-haiku-5-5'],
      ['{"ok":true}', undefined, undefined],
      [undefined, undefined, undefined],
    ]);
  });

  it('never lets a broken `describe` callback break the app', async () => {
    const { impl } = fakeFetch();
    const ep = client(impl);
    await expect(
      ep.trace(
        'a',
        {},
        () => 'fine',
        () => {
          throw new Error('bug in describe');
        },
      ),
    ).resolves.toBe('fine');
  });

  it('truncates very long text', async () => {
    const { impl, sent } = fakeFetch();
    const ep = client(impl);
    await ep.trace('a', { input: 'x'.repeat(TRACE_TEXT_MAX + 10) }, () => 'y'.repeat(TRACE_TEXT_MAX + 10));
    await ep.flush();
    expect(sent[0]?.traces[0]?.input).toHaveLength(TRACE_TEXT_MAX);
    expect(sent[0]?.traces[0]?.output).toHaveLength(TRACE_TEXT_MAX);
  });
});

describe('batching', () => {
  it('splits the queue into batches of maxBatchSize', async () => {
    const { impl, sent } = fakeFetch();
    const ep = client(impl, { maxBatchSize: 2 });
    for (let i = 0; i < 5; i++) ep.record({ name: `t${i}`, latencyMs: i });
    await ep.flush();
    expect(sent.map((s) => s.traces.length)).toEqual([2, 2, 1]);
    expect(ep.pending).toBe(0);
  });

  it('sends a full batch at once without waiting for the timer', async () => {
    const { impl, sent } = fakeFetch();
    const ep = client(impl, { maxBatchSize: 3 });
    for (let i = 0; i < 3; i++) ep.record({ name: `t${i}`, latencyMs: 1 });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
  });

  it('caps maxBatchSize at the API limit of 100', async () => {
    const { impl, sent } = fakeFetch();
    const ep = client(impl, { maxBatchSize: 500, maxQueueSize: 1000 });
    for (let i = 0; i < 150; i++) ep.record({ name: 't', latencyMs: 1 });
    await ep.flush();
    expect(sent.map((s) => s.traces.length)).toEqual([100, 50]);
  });

  it('drops the oldest traces when the queue is full', async () => {
    const errors: EvalPilotError[] = [];
    const { impl, sent } = fakeFetch();
    const ep = client(impl, { maxQueueSize: 3, maxBatchSize: 100, onError: (e) => errors.push(e) });
    for (let i = 0; i < 5; i++) ep.record({ name: `t${i}`, latencyMs: 1 });
    expect(errors.map((e) => e.dropped)).toEqual([1, 1]);
    await ep.flush();
    expect(sent[0]?.traces.map((t) => t.name)).toEqual(['t2', 't3', 't4']);
  });

  it('runs one flush at a time', async () => {
    const { impl, sent } = fakeFetch();
    const ep = client(impl);
    ep.record({ name: 'a', latencyMs: 1 });
    const first = ep.flush();
    ep.record({ name: 'b', latencyMs: 1 });
    await Promise.all([first, ep.flush()]);
    expect(sent.flatMap((s) => s.traces.map((t) => t.name))).toEqual(['a', 'b']);
  });

  describe('on a timer', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('flushes every flushIntervalMs', async () => {
      const { impl, sent } = fakeFetch();
      const ep = client(impl, { flushIntervalMs: 1000 });
      ep.record({ name: 'a', latencyMs: 1 });
      await vi.advanceTimersByTimeAsync(999);
      expect(sent).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(sent).toHaveLength(1);
      await ep.shutdown();
    });
  });
});

describe('delivery and retries', () => {
  it('retries 5xx, 429 and network errors, keeping the same externalIds', async () => {
    const { impl, sent } = fakeFetch([503, 'network', 429, 202]);
    const ep = client(impl, { maxRetries: 3 });
    ep.record({ name: 'a', latencyMs: 1 });
    await ep.flush();
    expect(sent).toHaveLength(4);
    expect(new Set(sent.map((s) => s.traces[0]?.externalId)).size).toBe(1);
  });

  it('honours Retry-After on 429', async () => {
    const { impl, sent } = fakeFetch([429, 202], { 'retry-after': '0.01' });
    const ep = client(impl);
    ep.record({ name: 'a', latencyMs: 1 });
    await ep.flush();
    expect(sent).toHaveLength(2);
  });

  it('gives up after maxRetries and reports the dropped traces', async () => {
    const errors: EvalPilotError[] = [];
    const { impl, sent } = fakeFetch(['network', 'network', 'network']);
    const ep = client(impl, { maxRetries: 2, onError: (e) => errors.push(e) });
    ep.record({ name: 'a', latencyMs: 1 });
    ep.record({ name: 'b', latencyMs: 1 });
    await expect(ep.flush()).resolves.toBeUndefined();
    expect(sent).toHaveLength(3);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ dropped: 2, message: 'Could not deliver 2 trace(s) after 3 attempts' });
  });

  it.each([400, 401, 403, 413])('does not retry HTTP %i', async (status) => {
    const errors: EvalPilotError[] = [];
    const { impl, sent } = fakeFetch([status]);
    const ep = client(impl, { onError: (e) => errors.push(e) });
    ep.record({ name: 'a', latencyMs: 1 });
    await ep.flush();
    expect(sent).toHaveLength(1);
    expect(errors[0]).toMatchObject({ status, dropped: 1 });
  });

  it('warns on the console by default', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { impl } = fakeFetch([401]);
    const ep = new EvalPilot({ apiKey: 'ep_live_test', baseUrl: 'http://api.test', fetch: impl });
    ep.record({ name: 'a', latencyMs: 1 });
    await ep.shutdown();
    expect(warn).toHaveBeenCalledWith('[evalpilot] EvalPilot rejected 1 trace(s) with HTTP 401');
    warn.mockRestore();
  });

  it('never throws when onError itself throws', async () => {
    const { impl } = fakeFetch([400]);
    const ep = client(impl, {
      onError: () => {
        throw new Error('bad handler');
      },
    });
    ep.record({ name: 'a', latencyMs: 1 });
    await expect(ep.flush()).resolves.toBeUndefined();
  });
});

describe('configuration', () => {
  it('is disabled without an API key, or when enabled is false', async () => {
    const { impl, sent } = fakeFetch();
    for (const ep of [
      new EvalPilot({ fetch: impl, apiKey: '' }),
      new EvalPilot({ fetch: impl, apiKey: 'ep_live_x', enabled: false }),
    ]) {
      await expect(ep.trace('a', {}, () => 42)).resolves.toBe(42);
      ep.record({ name: 'b', latencyMs: 1 });
      await ep.flush();
      expect(ep.pending).toBe(0);
    }
    expect(sent).toHaveLength(0);
  });

  it('reads the API key and URL from the environment', async () => {
    vi.stubEnv('EVALPILOT_API_KEY', 'ep_live_from_env');
    vi.stubEnv('EVALPILOT_URL', 'https://evalpilot.example.com/api/');
    try {
      const { impl, sent } = fakeFetch();
      const ep = new EvalPilot({ fetch: impl, onError: () => undefined });
      ep.record({ name: 'a', latencyMs: 1 });
      await ep.shutdown();
      expect(sent[0]?.url).toBe('https://evalpilot.example.com/api/v1/traces');
      expect(sent[0]?.headers.authorization).toBe('Bearer ep_live_from_env');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('ignores traces recorded after shutdown', async () => {
    const { impl, sent } = fakeFetch();
    const ep = client(impl);
    await ep.shutdown();
    ep.record({ name: 'late', latencyMs: 1 });
    await ep.flush();
    expect(sent).toHaveLength(0);
  });

  it.each([
    ['http://h:4000', 'http://h:4000'],
    ['http://h:4000/', 'http://h:4000'],
    ['http://h:4000/api', 'http://h:4000'],
    ['https://h/api//', 'https://h'],
  ])('normalises %s', (input, expected) => {
    expect(normalizeBaseUrl(input)).toBe(expected);
  });
});

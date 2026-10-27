import {
  EvalPilotError,
  type EvalPilotOptions,
  TRACE_BATCH_MAX,
  TRACE_TEXT_MAX,
  type TraceInput,
  type TraceMeta,
  type TraceResultInfo,
} from './types';

const DEFAULTS = {
  baseUrl: 'http://localhost:4000',
  flushIntervalMs: 2000,
  maxBatchSize: 50,
  maxQueueSize: 1000,
  maxRetries: 3,
  retryBaseMs: 500,
  requestTimeoutMs: 5000,
};
const MAX_RETRY_DELAY_MS = 10_000;

/** An environment variable, treating "" as not set. Safe outside Node. */
function env(name: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  const value = process.env[name];
  return value === undefined || value === '' ? undefined : value;
}

/** Accepts `http://host:4000`, `http://host:4000/` or `http://host:4000/api`. */
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '').replace(/\/api$/, '');
}

const truncate = (text: string | undefined) =>
  text !== undefined && text.length > TRACE_TEXT_MAX ? text.slice(0, TRACE_TEXT_MAX) : text;

function describeDefault(result: unknown): TraceResultInfo {
  if (typeof result === 'string') return { output: result };
  if (result === undefined || result === null) return {};
  try {
    return { output: JSON.stringify(result) };
  } catch {
    return { output: '[result could not be serialised]' };
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

function newId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * EvalPilot tracing client.
 *
 * ```ts
 * const ep = new EvalPilot({ apiKey: process.env.EVALPILOT_API_KEY });
 * const answer = await ep.trace('shopbot.chat', { input, model }, () => callLLM(input));
 * ```
 *
 * Traces are queued and sent in batches. Network problems are retried with backoff; when a batch
 * cannot be delivered it is dropped and `onError` is called. Tracing never throws into your app.
 */
export class EvalPilot {
  private readonly apiKey: string | undefined;
  private readonly endpoint: string;
  private readonly options: Required<
    Omit<EvalPilotOptions, 'apiKey' | 'baseUrl' | 'fetch' | 'onError' | 'enabled'>
  >;
  private readonly fetchImpl: typeof fetch;
  private readonly onError: (error: EvalPilotError) => void;
  private readonly enabled: boolean;
  private queue: TraceInput[] = [];
  private inFlight: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(options: EvalPilotOptions = {}) {
    this.apiKey = options.apiKey ?? env('EVALPILOT_API_KEY');
    this.endpoint = `${normalizeBaseUrl(options.baseUrl ?? env('EVALPILOT_URL') ?? DEFAULTS.baseUrl)}/api/v1/traces`;
    this.options = {
      flushIntervalMs: options.flushIntervalMs ?? DEFAULTS.flushIntervalMs,
      maxBatchSize: Math.min(TRACE_BATCH_MAX, Math.max(1, options.maxBatchSize ?? DEFAULTS.maxBatchSize)),
      maxQueueSize: Math.max(1, options.maxQueueSize ?? DEFAULTS.maxQueueSize),
      maxRetries: Math.max(0, options.maxRetries ?? DEFAULTS.maxRetries),
      retryBaseMs: Math.max(0, options.retryBaseMs ?? DEFAULTS.retryBaseMs),
      requestTimeoutMs: options.requestTimeoutMs ?? DEFAULTS.requestTimeoutMs,
    };
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.onError =
      options.onError ??
      ((error) => {
        console.warn(`[evalpilot] ${error.message}`);
      });
    this.enabled = (options.enabled ?? true) && Boolean(this.apiKey);
    if (this.enabled) {
      this.timer = setInterval(() => void this.flush(), this.options.flushIntervalMs);
      // Do not keep the host process alive just for tracing.
      (this.timer as { unref?: () => void }).unref?.();
    }
  }

  /** Number of traces waiting to be sent. */
  get pending(): number {
    return this.queue.length;
  }

  /**
   * Runs `fn`, measures it and records a trace. Returns (or throws) exactly what `fn` does.
   * `describe` maps the result to the answer text and token usage when it is not a plain string.
   */
  async trace<T>(
    name: string,
    meta: TraceMeta,
    fn: () => T | Promise<T>,
    describe?: (result: T) => TraceResultInfo,
  ): Promise<T> {
    const startedAt = new Date();
    const started = performance.now();
    try {
      const result = await fn();
      this.safely(() => {
        const info = describe ? describe(result) : describeDefault(result);
        this.record({
          ...this.base(name, meta, startedAt, started),
          output: truncate(info.output),
          model: info.model ?? meta.model,
          inputTokens: info.inputTokens,
          outputTokens: info.outputTokens,
          status: 'OK',
        });
      });
      return result;
    } catch (error) {
      this.safely(() => {
        this.record({
          ...this.base(name, meta, startedAt, started),
          model: meta.model,
          status: 'ERROR',
          error: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
        });
      });
      throw error;
    }
  }

  /** Queues a trace you measured yourself. */
  record(trace: TraceInput): void {
    if (!this.enabled || this.closed) return;
    this.queue.push({
      externalId: newId(),
      ...trace,
      input: truncate(trace.input),
      output: truncate(trace.output),
    });
    const overflow = this.queue.length - this.options.maxQueueSize;
    if (overflow > 0) {
      this.queue.splice(0, overflow);
      this.safely(() => {
        this.onError(new EvalPilotError(`Queue full: dropped the ${overflow} oldest trace(s)`, overflow));
      });
    }
    if (this.queue.length >= this.options.maxBatchSize) void this.flush();
  }

  /** Sends everything queued so far. Resolves when done (it never rejects). */
  async flush(): Promise<void> {
    if (!this.enabled) return;
    while (this.inFlight) await this.inFlight;
    if (this.queue.length === 0) return;
    this.inFlight = this.drain().finally(() => {
      this.inFlight = null;
    });
    await this.inFlight;
  }

  /** Stops the timer and sends what is left. Call it before your process exits. */
  async shutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush();
    this.closed = true;
  }

  private base(name: string, meta: TraceMeta, startedAt: Date, started: number): TraceInput {
    return {
      externalId: meta.externalId ?? newId(),
      name,
      input: truncate(meta.input),
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      startedAt: startedAt.toISOString(),
      ...(meta.metadata ? { metadata: meta.metadata } : {}),
    };
  }

  private async drain(): Promise<void> {
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.options.maxBatchSize);
      await this.send(batch);
    }
  }

  private async send(batch: TraceInput[]): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      let status: number | undefined;
      let retryAfterMs: number | undefined;
      try {
        const response = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey ?? ''}` },
          body: JSON.stringify({ traces: batch }),
          signal: AbortSignal.timeout(this.options.requestTimeoutMs),
        });
        if (response.ok) return;
        status = response.status;
        const retryAfter = Number(response.headers.get('retry-after'));
        if (Number.isFinite(retryAfter) && retryAfter > 0) retryAfterMs = retryAfter * 1000;
        if (status < 500 && status !== 429 && status !== 408) {
          this.fail(`EvalPilot rejected ${batch.length} trace(s) with HTTP ${status}`, batch.length, status);
          return;
        }
      } catch {
        // Network error or timeout: retry below.
      }
      if (attempt >= this.options.maxRetries) {
        this.fail(
          `Could not deliver ${batch.length} trace(s)${status ? ` (HTTP ${status})` : ''} after ${attempt + 1} attempts`,
          batch.length,
          status,
        );
        return;
      }
      const backoff = Math.min(MAX_RETRY_DELAY_MS, this.options.retryBaseMs * 2 ** attempt);
      await sleep(retryAfterMs ?? backoff * (0.5 + Math.random() / 2));
    }
  }

  private fail(message: string, dropped: number, status?: number): void {
    this.safely(() => {
      this.onError(new EvalPilotError(message, dropped, status));
    });
  }

  /** Tracing must never break the host app. */
  private safely(action: () => void): void {
    try {
      action();
    } catch {
      // Swallowed on purpose.
    }
  }
}

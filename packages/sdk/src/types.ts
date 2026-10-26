export type MetadataValue = string | number | boolean | null;

/** Max traces per request and max characters per text field (kept equal to @evalpilot/shared; see test). */
export const TRACE_BATCH_MAX = 100;
export const TRACE_TEXT_MAX = 50_000;

/** One trace as sent to `POST /v1/traces`. Matches the API's schema exactly (checked at compile time). */
export interface TraceInput {
  externalId?: string;
  name: string;
  input?: string;
  output?: string;
  model?: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  status?: 'OK' | 'ERROR';
  error?: string;
  metadata?: Record<string, MetadataValue>;
  /** ISO-8601 */
  startedAt?: string;
}

export interface TraceMeta {
  /** What was sent to the model (shown in the trace inspector). */
  input?: string;
  model?: string;
  /** Your own id for correlation; one is generated when omitted. */
  externalId?: string;
  metadata?: Record<string, MetadataValue>;
}

/** What the traced function produced, when its return value is not just the answer text. */
export interface TraceResultInfo {
  output?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface EvalPilotOptions {
  /** Project API key (`ep_live_…`). Defaults to `EVALPILOT_API_KEY`. Without a key, tracing is off. */
  apiKey?: string;
  /** EvalPilot API URL. Defaults to `EVALPILOT_URL`, then `http://localhost:4000`. */
  baseUrl?: string;
  /** Send queued traces at least this often. Default 2000 ms. */
  flushIntervalMs?: number;
  /** Traces per request (1–100). A full batch is sent at once. Default 50. */
  maxBatchSize?: number;
  /** Traces kept in memory while the API is unreachable; the oldest are dropped first. Default 1000. */
  maxQueueSize?: number;
  /** Retries per batch for network errors, 429 and 5xx. Default 3. */
  maxRetries?: number;
  /** First retry delay; doubles each time (with jitter), capped at 10 s. Default 500 ms. */
  retryBaseMs?: number;
  /** Per-request timeout. Default 5000 ms. */
  requestTimeoutMs?: number;
  /** Turn tracing off entirely (e.g. in tests). */
  enabled?: boolean;
  /** Custom fetch (tests, proxies). Defaults to the global fetch. */
  fetch?: typeof fetch;
  /** Called when traces are dropped. Defaults to a short console warning. Never throws into your app. */
  onError?: (error: EvalPilotError) => void;
}

export class EvalPilotError extends Error {
  constructor(
    message: string,
    /** How many traces were lost. */
    readonly dropped: number,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'EvalPilotError';
  }
}

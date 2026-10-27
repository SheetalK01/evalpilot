import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { Target } from '@prisma/client';
import { answerToText, assessTargetUrl, type CallUsage, extractUsage, readJsonPath } from '@evalpilot/shared';
import { type AppConfig, InjectConfig, SecretBoxService } from '@evalpilot/server-core';
import { type Agent, fetch } from 'undici';
import { createGuardedAgent } from './ssrf-agent';
import { buildTargetRequest } from './target-request';

export const MAX_RESPONSE_BYTES = 1_000_000;
export const RETRY_DELAYS_MS = [250, 1000];
const RETRYABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'EAI_AGAIN',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
]);

export interface TargetCall {
  output: string;
  latencyMs: number;
  usage: CallUsage;
}

/** A call that produced no usable answer. The message is safe to show to the user. */
export class TargetCallError extends Error {
  constructor(
    message: string,
    readonly latencyMs: number | null = null,
    readonly retryable = false,
  ) {
    super(message);
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

function causeCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;
  return typeof cause?.code === 'string' ? cause.code : undefined;
}

/** Turns low-level fetch errors into short, user-facing messages. */
export function describeFetchError(error: unknown, timeoutMs: number): TargetCallError {
  if (error instanceof TargetCallError) return error;
  // Checked by name: the DOMException may come from another realm, so `instanceof Error` is unreliable.
  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'TimeoutError' || name === 'AbortError') {
    return new TargetCallError(`Timed out after ${timeoutMs} ms`);
  }
  const code = causeCode(error);
  if (code === 'SSRF_BLOCKED') {
    const cause = (error as { cause: Error }).cause;
    return new TargetCallError(cause.message);
  }
  if (code === 'ENOTFOUND') return new TargetCallError('Host not found');
  if (code && RETRYABLE_CODES.has(code)) return new TargetCallError(`Network error (${code})`, null, true);
  return new TargetCallError(error instanceof Error ? `Request failed: ${error.message}` : 'Request failed');
}

async function readLimited(body: AsyncIterable<Uint8Array> | null, limit: number): Promise<string> {
  if (!body) return '';
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.byteLength;
    if (size > limit) throw new TargetCallError(`Response is larger than ${Math.round(limit / 1000)} KB`);
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Picks the answer out of the response body using the target's JSON path. */
export function extractAnswer(text: string, responsePath: string): { output: string; json: unknown } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    if (responsePath === '$' || responsePath === '') return { output: text, json: undefined };
    throw new TargetCallError(`Response is not JSON, so ${responsePath} cannot be read`);
  }
  const value = readJsonPath(json, responsePath);
  if (value === undefined) throw new TargetCallError(`Nothing found at ${responsePath} in the response`);
  return { output: answerToText(value), json };
}

/**
 * Sends one input to a target and returns its answer, latency and token usage. User-defined
 * targets go through the SSRF guard (unless ALLOW_PRIVATE_TARGETS=true). Network errors are
 * retried twice with backoff; timeouts and HTTP errors are not.
 */
@Injectable()
export class TargetClient implements OnModuleDestroy {
  private readonly guardedAgent: Agent = createGuardedAgent();

  constructor(
    @InjectConfig() private readonly config: AppConfig,
    private readonly secrets: SecretBoxService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.guardedAgent.close();
  }

  private headersOf(target: Pick<Target, 'headersJson'>): Record<string, string> {
    return target.headersJson
      ? (JSON.parse(this.secrets.open(target.headersJson)) as Record<string, string>)
      : {};
  }

  async call(target: Target, input: string): Promise<TargetCall> {
    const request = buildTargetRequest(target, this.headersOf(target), input, this.config.shopbotUrl);
    const guard = request.userDefined && !this.config.allowPrivateTargets;
    if (request.userDefined) {
      const assessment = assessTargetUrl(request.url, { allowPrivate: this.config.allowPrivateTargets });
      if (!assessment.ok) throw new TargetCallError(`Blocked: ${assessment.reason}`);
    }

    for (let attempt = 0; ; attempt++) {
      const started = performance.now();
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          redirect: guard ? 'error' : 'follow',
          signal: AbortSignal.timeout(target.timeoutMs),
          ...(guard ? { dispatcher: this.guardedAgent } : {}),
        });
        const text = await readLimited(response.body, MAX_RESPONSE_BYTES);
        const latencyMs = Math.round(performance.now() - started);
        if (!response.ok) throw new TargetCallError(`Target returned HTTP ${response.status}`, latencyMs);
        const { output, json } = extractAnswer(text, request.responsePath);
        return { output, latencyMs, usage: extractUsage(json, input, output) };
      } catch (error) {
        const failure = describeFetchError(error, target.timeoutMs);
        const delay = RETRY_DELAYS_MS[attempt];
        if (!failure.retryable || delay === undefined) {
          throw new TargetCallError(
            failure.message,
            failure.latencyMs ?? Math.round(performance.now() - started),
          );
        }
        await sleep(delay);
      }
    }
  }
}

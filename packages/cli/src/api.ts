import type { CliRun } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface EvalPilotApi {
  startRun(suiteId: string, commitSha: string | null): Promise<{ runId: string }>;
  getRun(runId: string): Promise<CliRun>;
}

/** Minimal client for the two `/v1` endpoints the CLI needs. */
export function createApi(baseUrl: string, apiKey: string, fetchImpl: typeof fetch = fetch): EvalPilotApi {
  const root = `${baseUrl.replace(/\/+$/, '').replace(/\/api$/, '')}/api/v1`;

  async function call<T>(method: 'GET' | 'POST', path: string, body?: object): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'user-agent': 'evalpilot-cli',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new ApiError(
        `Cannot reach EvalPilot at ${root}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!response.ok) {
      const message = (json as { message?: unknown } | null)?.message;
      throw new ApiError(
        `HTTP ${response.status}: ${typeof message === 'string' ? message : response.statusText || 'request failed'}`,
        response.status,
      );
    }
    return json as T;
  }

  return {
    startRun: (suiteId, commitSha) =>
      call('POST', `/suites/${encodeURIComponent(suiteId)}/runs`, commitSha ? { commitSha } : {}),
    getRun: (runId) => call('GET', `/runs/${encodeURIComponent(runId)}`),
  };
}

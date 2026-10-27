import type { ApiErrorBody } from '@evalpilot/shared';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

/** An API error with everything the UI shows: message, field errors and the request id. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly requestId: string | null = null,
    readonly fieldErrors: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Body = object | string | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: Body;
  /** Send a raw body with this content type (e.g. text/csv). */
  contentType?: string;
  signal?: AbortSignal;
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'message' in value && 'statusCode' in value;
}

/** fetch wrapper for the EvalPilot API: session cookie, JSON, and typed errors. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, contentType, signal } = options;
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    headers['content-type'] = contentType ?? 'application/json';
    payload = typeof body === 'string' ? body : JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: payload,
      credentials: 'include',
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Cannot reach the EvalPilot API. Is it running?');
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!response.ok) {
    if (isErrorBody(json))
      throw new ApiError(response.status, json.message, json.requestId, json.errors ?? []);
    throw new ApiError(
      response.status,
      response.statusText || 'Request failed',
      response.headers.get('x-request-id'),
    );
  }
  return json as T;
}

/** Downloads a file from the API (e.g. CSV export) and saves it in the browser. */
export async function download(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`${API_URL}/api${path}`, { credentials: 'include' });
  if (!response.ok)
    throw new ApiError(response.status, 'Download failed', response.headers.get('x-request-id'));
  const name =
    /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking right away can cancel the download in Chromium; give it a moment first.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

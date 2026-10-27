import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[\w.-]{8,64}$/;

/** Reuses a well-formed incoming `x-request-id` (e.g. from a proxy) or generates one, and echoes it back. */
export function resolveRequestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const id = typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, id);
  return id;
}

export function requestIdOf(req: { id?: unknown }): string {
  return typeof req.id === 'string' ? req.id : 'unknown';
}

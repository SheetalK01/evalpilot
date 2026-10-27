import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '@/lib/api';

const respond = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers,
    }),
  );

describe('api()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends JSON with the session cookie and returns the body', async () => {
    const fetch = respond(200, { id: 'p1' });
    await expect(api('/projects', { method: 'POST', body: { name: 'x' } })).resolves.toEqual({ id: 'p1' });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/api/projects');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: '{"name":"x"}',
      headers: { 'content-type': 'application/json' },
    });
  });

  it('sends raw bodies with a custom content type', async () => {
    const fetch = respond(201, { imported: 1, errors: [] });
    await api('/suites/s/import', { method: 'POST', body: 'name,input,checks', contentType: 'text/csv' });
    expect(fetch.mock.calls[0]![1]).toMatchObject({
      body: 'name,input,checks',
      headers: { 'content-type': 'text/csv' },
    });
  });

  it('returns undefined for 204', async () => {
    respond(204);
    await expect(api('/projects/p1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('turns the API error format into an ApiError with request id and field errors', async () => {
    respond(400, {
      statusCode: 400,
      message: 'Validation failed',
      errors: [{ path: 'name', message: 'Required' }],
      path: '/api/projects',
      requestId: 'req-123',
      timestamp: 'now',
    });
    const error = await api('/projects').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      message: 'Validation failed',
      requestId: 'req-123',
      fieldErrors: [{ path: 'name', message: 'Required' }],
    });
  });

  it('handles non-JSON errors and keeps the request id header', async () => {
    respond(502, '<html>Bad gateway</html>', { 'x-request-id': 'edge-1' });
    await expect(api('/health')).rejects.toMatchObject({ status: 502, requestId: 'edge-1' });
  });

  it('reports an unreachable API clearly', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api('/health')).rejects.toMatchObject({
      status: 0,
      message: 'Cannot reach the EvalPilot API. Is it running?',
    });
  });
});

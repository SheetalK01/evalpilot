import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Target } from '@prisma/client';
import { type AppConfig, SecretBox } from '@evalpilot/server-core';
import { randomBytes } from 'node:crypto';
import {
  describeFetchError,
  extractAnswer,
  MAX_RESPONSE_BYTES,
  TargetCallError,
  TargetClient,
} from './target-client';

type Handler = (body: string, res: ServerResponse) => void;

describe('TargetClient', () => {
  let server: Server;
  let baseUrl: string;
  let handler: Handler;
  const secrets = new SecretBox(randomBytes(32));
  const client = (allowPrivateTargets = true) =>
    new TargetClient({ allowPrivateTargets, shopbotUrl: 'http://127.0.0.1:1' } as AppConfig, secrets);

  const target = (overrides: Partial<Target> = {}): Target =>
    ({
      id: 't1',
      type: 'HTTP',
      url: `${baseUrl}/chat`,
      method: 'POST',
      bodyTemplate: '{"message":"{{input}}"}',
      responsePath: '$.reply',
      timeoutMs: 1000,
      headersJson: null,
      ...overrides,
    }) as Target;

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => (body += chunk.toString()));
      req.on('end', () => handler(body, res));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  const json =
    (status: number, value: unknown): Handler =>
    (_body, res) => {
      res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(value));
    };

  it('returns the answer at the JSON path with latency and reported usage', async () => {
    handler = json(200, {
      reply: 'Refunds within 30 days',
      model: 'claude-haiku-5-5',
      usage: { input_tokens: 12, output_tokens: 6 },
    });
    const call = await client().call(target(), 'refund?');
    expect(call.output).toBe('Refunds within 30 days');
    expect(call.latencyMs).toBeGreaterThanOrEqual(0);
    expect(call.usage).toEqual({
      model: 'claude-haiku-5-5',
      inputTokens: 12,
      outputTokens: 6,
      reported: true,
    });
  });

  it('sends decrypted headers', async () => {
    let seen = '';
    handler = (body, res) => {
      seen = body;
      json(200, { reply: 'ok' })(body, res);
    };
    const withHeaders = target({ headersJson: secrets.seal(JSON.stringify({ 'X-Api-Key': 'k' })) });
    await client().call(withHeaders, 'hello');
    expect(JSON.parse(seen)).toEqual({ message: 'hello' });
  });

  it('accepts plain-text answers when the path is $', async () => {
    handler = (_b, res) => res.writeHead(200, { 'content-type': 'text/plain' }).end('Just text');
    expect((await client().call(target({ responsePath: '$' }), 'x')).output).toBe('Just text');
  });

  it.each([
    ['HTTP errors', json(503, {}), 'Target returned HTTP 503'],
    ['a missing JSON path', json(200, { answer: 'x' }), 'Nothing found at $.reply in the response'],
    [
      'non-JSON with a JSON path',
      (_b, res) => res.end('<html>'),
      'Response is not JSON, so $.reply cannot be read',
    ],
    [
      'oversized responses',
      (_b, res) => res.end('x'.repeat(MAX_RESPONSE_BYTES + 10)),
      'Response is larger than 1000 KB',
    ],
  ])('reports %s', async (_label, reply, message) => {
    handler = reply;
    await expect(client().call(target(), 'x')).rejects.toThrow(new TargetCallError(message));
  });

  it('times out slow targets without retrying', async () => {
    let calls = 0;
    handler = () => {
      calls += 1; // never answers
    };
    await expect(client().call(target({ timeoutMs: 1000 }), 'x')).rejects.toThrow('Timed out after 1000 ms');
    expect(calls).toBe(1);
  });

  it('retries connection errors twice, then gives up', async () => {
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
    const port = (closed.address() as AddressInfo).port;
    await new Promise((resolve) => closed.close(resolve));
    const started = Date.now();
    await expect(client().call(target({ url: `http://127.0.0.1:${port}/chat` }), 'x')).rejects.toThrow(
      'Network error (ECONNREFUSED)',
    );
    expect(Date.now() - started).toBeGreaterThanOrEqual(1250); // 250 ms + 1000 ms backoff
  });

  it('blocks private addresses when private targets are not allowed', async () => {
    handler = json(200, { reply: 'should never be reached' });
    await expect(client(false).call(target(), 'x')).rejects.toThrow(
      'Blocked: Address 127.0.0.1 is private or reserved',
    );
  });
});

describe('describeFetchError', () => {
  const withCause = (code: string, message = code) =>
    Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error(message), { code }) });

  it.each([
    [withCause('ENOTFOUND'), 'Host not found', false],
    [withCause('ECONNRESET'), 'Network error (ECONNRESET)', true],
    [
      withCause('SSRF_BLOCKED', 'Blocked: x resolves to private address 10.0.0.1'),
      'Blocked: x resolves to private address 10.0.0.1',
      false,
    ],
    [new TypeError('fetch failed'), 'Request failed: fetch failed', false],
    ['weird', 'Request failed', false],
  ])('maps %p', (error, message, retryable) => {
    const mapped = describeFetchError(error, 1000);
    expect(mapped.message).toBe(message);
    expect(mapped.retryable).toBe(retryable);
  });

  it('keeps TargetCallErrors as they are', () => {
    const original = new TargetCallError('Target returned HTTP 500', 12);
    expect(describeFetchError(original, 1000)).toBe(original);
  });
});

describe('extractAnswer', () => {
  it('stringifies non-string values', () => {
    expect(extractAnswer('{"a":{"b":[1,2]}}', '$.a').output).toBe('{"b":[1,2]}');
  });
});

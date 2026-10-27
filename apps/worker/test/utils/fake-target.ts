import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeRequest {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
  json: unknown;
}

export interface FakeReply {
  status?: number;
  body?: unknown;
  /** Raw text body instead of JSON. */
  text?: string;
  delayMs?: number;
}

export interface FakeTarget {
  url: string;
  requests: FakeRequest[];
  close: () => Promise<void>;
}

/** A local HTTP server that plays an AI app. `reply` decides the answer for each request. */
export async function startFakeTarget(
  reply: (request: FakeRequest) => FakeReply | Promise<FakeReply>,
): Promise<FakeTarget> {
  const requests: FakeRequest[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      let json: unknown;
      try {
        json = body ? JSON.parse(body) : undefined;
      } catch {
        json = undefined;
      }
      const request = { method: req.method ?? 'GET', url: req.url ?? '/', headers: req.headers, body, json };
      requests.push(request);
      void Promise.resolve(reply(request)).then(async (answer) => {
        if (answer.delayMs) await new Promise((resolve) => setTimeout(resolve, answer.delayMs));
        if (res.destroyed) return;
        res.statusCode = answer.status ?? 200;
        if (answer.text !== undefined) {
          res.setHeader('content-type', 'text/plain');
          res.end(answer.text);
        } else {
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(answer.body ?? {}));
        }
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** The message a test case sent, for targets using `{"message":"{{input}}"}`. */
export const messageOf = (request: FakeRequest): string =>
  (request.json as { message?: string } | undefined)?.message ?? '';

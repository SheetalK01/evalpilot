import { MatchersV3, PactV3 } from '@pact-foundation/pact';
import { describe, expect, it } from 'vitest';
import { EvalPilot, type EvalPilotError } from '../../packages/sdk/src';
import { PACT_API_KEY, PACT_DIR, PROVIDER } from '../pact.config';

const { eachLike, integer, like, regex, datetime } = MatchersV3;

const provider = new PactV3({
  consumer: 'evalpilot-sdk',
  provider: PROVIDER,
  dir: PACT_DIR,
  logLevel: 'warn',
});

/** What one trace looks like on the wire, as the SDK sends it. */
const traceShape = {
  externalId: like('3f1c2a9e-6f0a-4c39-9d6e-2b7f5a1c0e44'),
  name: like('shopbot.chat'),
  input: like('Where is my order #10423?'),
  output: like('Order #10423 is out for delivery today.'),
  model: like('claude-opus-5-5'),
  latencyMs: integer(412),
  inputTokens: integer(120),
  outputTokens: integer(18),
  status: regex('^(OK|ERROR)$', 'OK'),
  startedAt: datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", '2026-10-26T10:15:30.123Z'),
};

describe('SDK → POST /api/v1/traces', () => {
  it('delivers a batch of traces with the project API key', async () => {
    provider
      .given('a project with an API key')
      .uponReceiving('a batch of traces from the SDK')
      .withRequest({
        method: 'POST',
        path: '/api/v1/traces',
        headers: {
          authorization: regex('^Bearer ep_live_[A-Za-z0-9_-]{32,64}$', `Bearer ${PACT_API_KEY}`),
          'content-type': regex('^application/json', 'application/json'),
        },
        body: { traces: eachLike(traceShape) },
      })
      // Consumer-driven: the SDK only looks at the status code, so that is all it asks for.
      .willRespondWith({ status: 202 });

    await provider.executeTest(async (mockServer) => {
      const errors: EvalPilotError[] = [];
      const ep = new EvalPilot({
        apiKey: PACT_API_KEY,
        baseUrl: mockServer.url,
        maxRetries: 0,
        onError: (e) => errors.push(e),
      });
      for (const input of ['Where is my order #10423?', 'Can I return a jacket?']) {
        ep.record({
          name: 'shopbot.chat',
          input,
          output: 'Order #10423 is out for delivery today.',
          model: 'claude-opus-5-5',
          latencyMs: 412,
          inputTokens: 120,
          outputTokens: 18,
          status: 'OK',
          startedAt: new Date().toISOString(),
        });
      }
      await ep.shutdown();
      expect(errors).toEqual([]);
    });
  });

  it('gets 401 for an invalid key and drops the batch without throwing', async () => {
    provider
      .given('no API key matches')
      .uponReceiving('a batch of traces with an unknown API key')
      .withRequest({
        method: 'POST',
        path: '/api/v1/traces',
        headers: { authorization: regex('^Bearer .+$', `Bearer ep_live_${'x'.repeat(32)}`) },
        body: { traces: eachLike(traceShape) },
      })
      .willRespondWith({ status: 401 });

    await provider.executeTest(async (mockServer) => {
      const errors: EvalPilotError[] = [];
      const ep = new EvalPilot({
        apiKey: `ep_live_${'x'.repeat(32)}`,
        baseUrl: mockServer.url,
        onError: (e) => errors.push(e),
      });
      ep.record({
        name: 'shopbot.chat',
        input: 'hi',
        output: 'hello',
        model: 'claude-opus-5-5',
        latencyMs: 5,
        inputTokens: 1,
        outputTokens: 1,
        status: 'OK',
        startedAt: new Date().toISOString(),
      });
      await ep.shutdown();
      expect(errors.map((e) => e.status)).toEqual([401]);
    });
  });
});

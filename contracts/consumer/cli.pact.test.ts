import { MatchersV3, PactV3 } from '@pact-foundation/pact';
import { describe, expect, it } from 'vitest';
import { createApi } from '../../packages/cli/src/api';
import { PACT_API_KEY, PACT_DIR, PACT_RUN_ID, PACT_SUITE_ID, PROVIDER } from '../pact.config';

const { boolean, eachLike, integer, like, number, regex } = MatchersV3;
const provider = new PactV3({
  consumer: 'evalpilot-cli',
  provider: PROVIDER,
  dir: PACT_DIR,
  logLevel: 'warn',
});
const auth = { authorization: regex('^Bearer ep_live_[A-Za-z0-9_-]{32,64}$', `Bearer ${PACT_API_KEY}`) };

describe('CLI → /api/v1 runs', () => {
  it('starts a run for a suite (202)', async () => {
    provider
      .given('a suite with a target and test cases', { suiteId: PACT_SUITE_ID })
      .uponReceiving('a request from the CLI to start a run')
      .withRequest({
        method: 'POST',
        path: `/api/v1/suites/${PACT_SUITE_ID}/runs`,
        headers: auth,
        body: { commitSha: like('abc1234') },
      })
      .willRespondWith({ status: 202, body: { runId: like('cmvp61ifr0003boif25am22i7'), status: 'QUEUED' } });

    await provider.executeTest(async (mockServer) => {
      const created = await createApi(mockServer.url, PACT_API_KEY).startRun(PACT_SUITE_ID, 'abc1234');
      expect(created.runId).toEqual(expect.any(String));
    });
  });

  it('reads a finished run with its results', async () => {
    provider
      .given('a finished run with results', { runId: PACT_RUN_ID })
      .uponReceiving('a request from the CLI for a run')
      .withRequest({ method: 'GET', path: `/api/v1/runs/${PACT_RUN_ID}`, headers: auth })
      .willRespondWith({
        status: 200,
        body: {
          id: PACT_RUN_ID,
          suiteId: like(PACT_SUITE_ID),
          suiteName: like('ShopBot core support'),
          status: regex('^(QUEUED|RUNNING|PASSED|FAILED|ERROR|CANCELLED)$', 'FAILED'),
          total: integer(2),
          passed: integer(1),
          failed: integer(1),
          passRate: number(0.5),
          passThreshold: number(0.9),
          commitSha: like('abc1234'),
          error: null,
          results: eachLike({
            caseName: like('Refund window is 30 days'),
            position: integer(0),
            status: regex('^(PASSED|FAILED|ERROR)$', 'PASSED'),
            latencyMs: integer(412),
            checkResults: eachLike({
              type: like('contains'),
              passed: boolean(true),
              message: like('Contains "30 days"'),
            }),
            error: null,
          }),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const run = await createApi(mockServer.url, PACT_API_KEY).getRun(PACT_RUN_ID);
      expect(run.results[0]?.checkResults[0]?.type).toBe('contains');
    });
  });

  it('gets a 404 for a suite outside the key’s project', async () => {
    provider
      .given('a project with an API key')
      .uponReceiving('a request to start a run for an unknown suite')
      .withRequest({ method: 'POST', path: '/api/v1/suites/not-my-suite/runs', headers: auth, body: {} })
      .willRespondWith({ status: 404, body: { statusCode: 404, message: 'Suite not found' } });

    await provider.executeTest(async (mockServer) => {
      await expect(createApi(mockServer.url, PACT_API_KEY).startRun('not-my-suite', null)).rejects.toThrow(
        'HTTP 404: Suite not found',
      );
    });
  });
});

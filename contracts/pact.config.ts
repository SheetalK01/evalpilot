import { resolve } from 'node:path';

export const PACT_DIR = resolve(__dirname, 'pacts');
export const PROVIDER = 'evalpilot-api';

/** Example values that appear in the contracts. Provider states create matching data. */
export const PACT_API_KEY = 'ep_live_pactContractExampleKey_0123456789';
export const PACT_SUITE_ID = 'pact-suite-1';
export const PACT_RUN_ID = 'pact-run-1';

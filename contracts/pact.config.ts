import { resolve } from 'node:path';

export const PACT_DIR = resolve(__dirname, 'pacts');
export const PROVIDER = 'evalpilot-api';

/** Example values that appear in the contracts. Provider states create matching data. */
export const PACT_API_KEY = 'ep_live_pactContractExampleKey_0123456789';
export const PACT_SUITE_ID = 'pact-suite-1';
export const PACT_RUN_ID = 'pact-run-1';

/** The signed-in user and project behind the web app's contract (cookie session). */
export const PACT_USER_ID = 'pact-user-1';
export const PACT_PROJECT_ID = 'pact-project-1';
export const PACT_KEY_ID = 'pact-key-1';
/** Port of the web contract's mock server: the web client reads its API URL once, at import. */
export const WEB_PACT_PORT = 9471;

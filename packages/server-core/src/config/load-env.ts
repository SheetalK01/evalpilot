import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

/** Loads the repo-root `.env` for local runs. In Docker/CI, variables come from the environment. */
export function loadRootEnv(): void {
  const path = resolve(__dirname, '../../../../.env');
  if (existsSync(path)) config({ path, quiet: true });
}

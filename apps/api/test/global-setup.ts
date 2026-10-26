import { execSync } from 'node:child_process';
import { loadTestEnv, REPO_ROOT } from './load-test-env';

/** Once per run: migrate the test database and empty every table. Each test then creates its own data. */
export default function globalSetup(): void {
  loadTestEnv();
  execSync('bash scripts/reset-test-db.sh', { cwd: REPO_ROOT, env: process.env, stdio: 'pipe' });
}

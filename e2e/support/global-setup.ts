import type { HealthResponse } from '@evalpilot/shared';
import { API_URL } from './env';

/** The worker has no port of its own, so wait until the API sees its heartbeat. */
export default async function globalSetup(): Promise<void> {
  const deadline = Date.now() + 60_000;
  let last = 'no response';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${API_URL}/api/health`);
      const health = (await res.json()) as HealthResponse;
      if (health.checks.worker === 'up' && health.checks.db === 'up' && health.checks.redis === 'up') return;
      last = JSON.stringify(health.checks);
    } catch (error) {
      last = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The E2E stack did not become healthy: ${last}`);
}

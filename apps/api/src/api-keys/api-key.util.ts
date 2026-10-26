import { createHash, randomBytes } from 'node:crypto';
import { API_KEY_PREFIX } from '@evalpilot/shared';

/** `ep_live_` + 32 random URL-safe characters (192 bits of entropy). */
export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
}

/** Keys are high-entropy random strings, so a fast hash (SHA-256) is safe; no salt needed. */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

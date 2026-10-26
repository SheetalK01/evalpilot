import { z } from 'zod';

/** Every API key starts with this, so leaked keys are easy to recognise and scan for. */
export const API_KEY_PREFIX = 'ep_live_';
/** Characters of the key (including the prefix) that are stored and shown in the UI. */
export const API_KEY_VISIBLE_CHARS = API_KEY_PREFIX.length + 4;

export const apiKeyFormat = /^ep_live_[A-Za-z0-9_-]{32,64}$/;

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, 'Name the key').max(60),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export function isApiKeyFormat(value: string): boolean {
  return apiKeyFormat.test(value);
}

export function apiKeyDisplayPrefix(rawKey: string): string {
  return rawKey.slice(0, API_KEY_VISIBLE_CHARS);
}

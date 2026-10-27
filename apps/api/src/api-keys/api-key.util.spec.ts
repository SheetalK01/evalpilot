import { isApiKeyFormat } from '@evalpilot/shared';
import { generateApiKey, hashApiKey } from './api-key.util';

describe('API key utilities', () => {
  it('generates well-formed, unique keys', () => {
    const keys = new Set(Array.from({ length: 200 }, generateApiKey));
    expect(keys.size).toBe(200);
    for (const key of keys) expect(isApiKeyFormat(key)).toBe(true);
  });

  it('hashes deterministically to 64 hex chars', () => {
    const key = generateApiKey();
    expect(hashApiKey(key)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(key)).toBe(hashApiKey(key));
    expect(hashApiKey(key)).not.toBe(hashApiKey(generateApiKey()));
  });
});

import type { AppConfig } from '../../config/env';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { throttlerOptions, trackerFor } from './throttler';

describe('trackerFor', () => {
  it('tracks API-key traffic per key, without storing the key', () => {
    const tracker = trackerFor({ ip: '1.1.1.1', headers: { authorization: 'Bearer ep_live_secret' } });
    expect(tracker).toMatch(/^key:[0-9a-f]{16}$/);
    expect(tracker).not.toContain('secret');
    expect(trackerFor({ ip: '2.2.2.2', headers: { authorization: 'Bearer ep_live_secret' } })).toBe(tracker);
  });

  it('tracks login attempts per IP and normalised email', () => {
    expect(trackerFor({ ip: '1.1.1.1', headers: {}, body: { email: ' Ada@Example.com ' } })).toBe(
      'ip:1.1.1.1|email:ada@example.com',
    );
  });

  it('falls back to the IP', () => {
    expect(trackerFor({ ip: '1.1.1.1', headers: {} })).toBe('ip:1.1.1.1');
    expect(trackerFor({ headers: {}, body: 'csv text' })).toBe('ip:unknown');
  });
});

describe('throttlerOptions', () => {
  const options = throttlerOptions({ rateLimits: { default: 300, auth: 10, v1: 1200 } } as AppConfig);
  const throttlers = Array.isArray(options) ? options : options.throttlers;

  class Controller {
    plain(): void {}
    @RateLimit('auth')
    login(): void {}
    @RateLimit('v1')
    ingest(): void {}
  }
  const contextFor = (handler: keyof Controller) =>
    ({ getHandler: () => Controller.prototype[handler], getClass: () => Controller }) as never;

  it.each([
    ['plain', 'default'],
    ['login', 'auth'],
    ['ingest', 'v1'],
  ] as const)('puts %s in exactly the %s bucket', (handler, bucket) => {
    const active = throttlers
      .filter((throttler) => !throttler.skipIf?.(contextFor(handler)))
      .map((throttler) => throttler.name);
    expect(active).toEqual([bucket]);
  });

  it('uses the configured limits', () => {
    expect(throttlers.map((throttler) => [throttler.name, throttler.limit])).toEqual([
      ['default', 300],
      ['auth', 10],
      ['v1', 1200],
    ]);
  });
});

import { ForbiddenException } from '@nestjs/common';
import type { AppConfig } from '../../config/env';
import { CsrfOriginGuard } from './csrf-origin.guard';

const guard = new CsrfOriginGuard({ allowedOrigins: ['http://localhost:3000'] } as AppConfig);
const contextFor = (method: string, headers: Record<string, string> = {}) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ method, headers }) }) }) as never;

describe('CsrfOriginGuard', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])('allows safe method %s without an Origin', (method) => {
    expect(guard.canActivate(contextFor(method))).toBe(true);
  });

  it('allows an allow-listed Origin', () => {
    expect(guard.canActivate(contextFor('POST', { origin: 'http://localhost:3000' }))).toBe(true);
  });

  it('falls back to the Referer origin', () => {
    expect(guard.canActivate(contextFor('DELETE', { referer: 'http://localhost:3000/app/settings' }))).toBe(
      true,
    );
  });

  it('exempts API-key (Bearer) requests, which carry no cookies', () => {
    expect(guard.canActivate(contextFor('POST', { authorization: 'Bearer ep_live_abc' }))).toBe(true);
  });

  it.each([
    ['no Origin or Referer', {}, 'Missing Origin header'],
    ['an unparseable Referer', { referer: 'not a url' }, 'Missing Origin header'],
    ['a foreign Origin', { origin: 'https://evil.example' }, 'Origin not allowed'],
    ['a look-alike Origin', { origin: 'http://localhost:3000.evil.example' }, 'Origin not allowed'],
    [
      'a Basic auth header',
      { authorization: 'Basic abc', origin: 'https://evil.example' },
      'Origin not allowed',
    ],
  ])('blocks a POST with %s', (_label, headers, message) => {
    expect(() => guard.canActivate(contextFor('POST', headers))).toThrow(new ForbiddenException(message));
  });
});

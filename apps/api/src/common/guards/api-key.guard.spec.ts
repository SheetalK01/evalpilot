import { UnauthorizedException } from '@nestjs/common';
import type { ApiKeysService } from '../../api-keys/api-keys.service';
import { ApiKeyGuard, bearerToken } from './api-key.guard';

const contextFor = (req: object) => ({ switchToHttp: () => ({ getRequest: () => req }) }) as never;
const context = { apiKeyId: 'k1', projectId: 'p1', ownerId: 'u1' };

describe('bearerToken', () => {
  it.each([
    [undefined, null],
    ['Basic abc', null],
    ['Bearer', null],
    ['Bearer ep_live_abc', 'ep_live_abc'],
    ['bearer ep_live_abc', 'ep_live_abc'],
  ])('%j → %j', (authorization, expected) => {
    expect(bearerToken({ headers: authorization ? { authorization } : {} } as never)).toBe(expected);
  });
});

describe('ApiKeyGuard', () => {
  const authenticate = jest.fn();
  const guard = new ApiKeyGuard({ authenticate } as unknown as ApiKeysService);

  beforeEach(() => authenticate.mockReset());

  it('attaches the key context to the request', async () => {
    authenticate.mockResolvedValue(context);
    const req: { headers: object; apiKey?: unknown } = { headers: { authorization: 'Bearer ep_live_abc' } };
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledWith('ep_live_abc');
    expect(req.apiKey).toEqual(context);
  });

  it('explains how to authenticate when no key is sent', async () => {
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toThrow(/Authorization: Bearer/);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('rejects invalid or revoked keys', async () => {
    authenticate.mockResolvedValue(null);
    await expect(
      guard.canActivate(contextFor({ headers: { authorization: 'Bearer ep_live_revoked' } })),
    ).rejects.toThrow(new UnauthorizedException('Invalid or revoked API key'));
  });
});

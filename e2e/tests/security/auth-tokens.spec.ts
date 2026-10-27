import { SESSION_COOKIE } from '@evalpilot/shared';
import { expect, test } from '@playwright/test';
import { registerUser } from '../../support/api';
import { API_URL, stackEnv } from '../../support/env';
import { signJwt } from '../../support/jwt';

const now = () => Math.floor(Date.now() / 1000);

test.describe('Session tokens @security', () => {
  test('tampered, expired, wrongly signed and alg:none tokens are all rejected', async ({ request }) => {
    const { user, api } = await registerUser('jwt');
    const { cookies } = await api.ctx.storageState();
    const real = cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? '';
    expect(real.split('.')).toHaveLength(3);

    const secret = stackEnv().JWT_SECRET ?? '';
    const [head, , signature] = real.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: user.id, admin: true, iat: now() })).toString(
      'base64url',
    );
    const tokens: Record<string, string> = {
      tampered: `${head}.${forgedPayload}.${signature}`,
      expired: signJwt({ sub: user.id, iat: now() - 7200, exp: now() - 3600 }, secret),
      wrongSecret: signJwt(
        { sub: user.id, iat: now(), exp: now() + 3600 },
        'not-the-real-secret-not-the-real-secret',
      ),
      algNone: signJwt({ sub: user.id, iat: now(), exp: now() + 3600 }, secret, 'none'),
      garbage: 'not.a.jwt',
    };

    for (const [label, token] of Object.entries(tokens)) {
      const res = await request.get(`${API_URL}/api/auth/me`, {
        headers: { Cookie: `${SESSION_COOKIE}=${token}` },
      });
      expect(res.status(), label).toBe(401);
    }

    // Sanity check: a correctly signed, unexpired token for the same user works.
    const valid = signJwt({ sub: user.id, iat: now(), exp: now() + 3600 }, secret);
    const ok = await request.get(`${API_URL}/api/auth/me`, {
      headers: { Cookie: `${SESSION_COOKIE}=${valid}` },
    });
    expect(ok.status()).toBe(200);
    await api.ctx.dispose();
  });

  test('the session cookie is httpOnly and SameSite=Lax', async () => {
    const { api } = await registerUser('cookie');
    const { cookies } = await api.ctx.storageState();
    const cookie = cookies.find((c) => c.name === SESSION_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    await api.ctx.dispose();
  });

  test('scripts on the page cannot read the session cookie', async ({ page, context }) => {
    const { api } = await registerUser('httponly');
    await context.addCookies((await api.ctx.storageState()).cookies);
    await page.goto('/app');
    await page.getByTestId('dashboard').waitFor();
    expect(await page.evaluate(() => document.cookie)).not.toContain(SESSION_COOKIE);
    await api.ctx.dispose();
  });
});

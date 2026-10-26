import { JwtService } from '@nestjs/jwt';
import { SESSION_COOKIE } from '@evalpilot/shared';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { ApiClient, signUp, TEST_PASSWORD, uniqueEmail } from '../utils/api-client';
import { createTestApp, type TestApp } from '../utils/test-app';

const sessionCookie = (res: request.Response): string | undefined => {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
};

describe('Auth API', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  describe('POST /auth/register', () => {
    it('creates the account, hashes the password and starts a session', async () => {
      const client = new ApiClient(t);
      const email = uniqueEmail();
      const res = await client
        .post('/auth/register', { name: 'Ada', email: email.toUpperCase(), password: TEST_PASSWORD })
        .expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        name: 'Ada',
        email,
        avatarUrl: null,
        createdAt: expect.any(String),
      });
      expect(res.body).not.toHaveProperty('passwordHash');

      const cookie = sessionCookie(res);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).not.toMatch(/Secure/i); // only in production

      const stored = await t.prisma.user.findUniqueOrThrow({ where: { email } });
      expect(stored.passwordHash).not.toBe(TEST_PASSWORD);
      expect(await bcrypt.compare(TEST_PASSWORD, stored.passwordHash ?? '')).toBe(true);

      await client.get('/auth/me').expect(200);
    });

    it('rejects a duplicate email (any case) with 409', async () => {
      const { email } = await signUp(t);
      const res = await new ApiClient(t)
        .post('/auth/register', { name: 'Twin', email: email.toUpperCase(), password: TEST_PASSWORD })
        .expect(409);
      expect(res.body.message).toBe('An account with this email already exists');
    });

    it('returns field errors in the standard error format', async () => {
      const res = await new ApiClient(t)
        .post('/auth/register', { name: '', email: 'nope', password: 'short' })
        .expect(400);
      expect(res.body).toMatchObject({
        statusCode: 400,
        message: 'Validation failed',
        path: '/api/auth/register',
      });
      expect(res.body.requestId).toEqual(expect.any(String));
      expect(res.body.errors.map((error: { path: string }) => error.path)).toEqual(
        expect.arrayContaining(['name', 'email', 'password']),
      );
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with any email casing', async () => {
      const { email } = await signUp(t);
      const client = new ApiClient(t);
      const res = await client
        .post('/auth/login', { email: email.toUpperCase(), password: TEST_PASSWORD })
        .expect(200);
      expect(res.body.email).toBe(email);
      expect(sessionCookie(res)).toBeDefined();
      await client.get('/auth/me').expect(200);
    });

    it('gives the same 401 for a wrong password and an unknown email', async () => {
      const { email } = await signUp(t);
      const wrongPassword = await new ApiClient(t)
        .post('/auth/login', { email, password: 'Wrong-password-1' })
        .expect(401);
      const unknownEmail = await new ApiClient(t)
        .post('/auth/login', { email: uniqueEmail(), password: TEST_PASSWORD })
        .expect(401);
      expect(wrongPassword.body.message).toBe('Invalid email or password');
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });

    it('validates the body before checking credentials', async () => {
      const res = await new ApiClient(t).post('/auth/login', { email: 'not-an-email' }).expect(400);
      expect(res.body.message).toBe('Validation failed');
    });

    it('rate-limits repeated attempts for the same email', async () => {
      const email = uniqueEmail();
      const client = new ApiClient(t);
      for (let attempt = 0; attempt < t.config.rateLimits.auth; attempt++) {
        await client.post('/auth/login', { email, password: 'Wrong-password-1' }).expect(401);
      }
      const blocked = await client.post('/auth/login', { email, password: 'Wrong-password-1' }).expect(429);
      expect(blocked.body.statusCode).toBe(429);
      // Another email from the same IP is not affected.
      await client.post('/auth/login', { email: uniqueEmail(), password: 'Wrong-password-1' }).expect(401);
    });
  });

  describe('sessions', () => {
    it('returns 401 without a session', async () => {
      const res = await request(t.server).get('/api/auth/me').expect(401);
      expect(res.body.message).toBe('Sign in to continue');
    });

    it('rejects a tampered token', async () => {
      const { user } = await signUp(t);
      const token = t.app.get(JwtService).sign({ sub: user.id });
      const tampered = `${token.slice(0, -2)}${token.endsWith('aa') ? 'bb' : 'aa'}`;
      await request(t.server).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${tampered}`).expect(401);
    });

    it('rejects a token signed with another secret', async () => {
      const { user } = await signUp(t);
      const forged = new JwtService({ secret: 'x'.repeat(40) }).sign({ sub: user.id });
      await request(t.server).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${forged}`).expect(401);
    });

    it('rejects an unsigned ("alg: none") token', async () => {
      const { user } = await signUp(t);
      const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: user.id })}.`;
      await request(t.server).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${unsigned}`).expect(401);
    });

    it('rejects an expired token', async () => {
      const { user } = await signUp(t);
      const expired = new JwtService({ secret: t.config.jwt.secret }).sign({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) - 60,
      });
      await request(t.server).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${expired}`).expect(401);
    });

    it('rejects a valid token of a deleted user', async () => {
      const { user } = await signUp(t);
      const token = t.app.get(JwtService).sign({ sub: user.id });
      await t.prisma.user.delete({ where: { id: user.id } });
      await request(t.server).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${token}`).expect(401);
    });

    it('logs out by clearing the cookie', async () => {
      const { client } = await signUp(t);
      const res = await client.post('/auth/logout').expect(204);
      expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
      await client.get('/auth/me').expect(401);
    });
  });

  describe('CSRF origin check', () => {
    it('blocks cookie-authenticated mutations without an Origin header', async () => {
      const { client } = await signUp(t);
      const res = await client.agent.post('/api/projects').send({ name: 'No origin' }).expect(403);
      expect(res.body.message).toBe('Missing Origin header');
    });

    it('blocks mutations from a foreign origin', async () => {
      const { client } = await signUp(t);
      const res = await client.agent
        .post('/api/projects')
        .set('Origin', 'https://evil.example')
        .send({ name: 'Evil' })
        .expect(403);
      expect(res.body.message).toBe('Origin not allowed');
    });

    it('accepts an allowed Referer when Origin is missing', async () => {
      const { client } = await signUp(t);
      await client.agent
        .post('/api/projects')
        .set('Referer', `${t.config.webUrl}/app`)
        .send({ name: 'Via referer' })
        .expect(201);
    });
  });

  describe('providers', () => {
    it('reports GitHub as disabled when it is not configured', async () => {
      await request(t.server).get('/api/auth/providers').expect(200, { github: false });
      const res = await request(t.server).get('/api/auth/github').expect(404);
      expect(res.body.message).toBe('GitHub sign-in is not configured');
    });
  });
});

import { healthSchema } from '@evalpilot/shared';
import request from 'supertest';
import { createTestApp, type TestApp } from '../utils/test-app';

describe('Platform: health, errors, headers, docs', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('GET /health reports DB and Redis as up', async () => {
    const res = await request(t.server).get('/api/health').expect(200);
    const health = healthSchema.parse(res.body);
    expect(health.status).toBe('ok');
    expect(health.checks).toMatchObject({ api: 'up', db: 'up', redis: 'up' });
  });

  it('generates a request id, or reuses a well-formed incoming one', async () => {
    const generated = await request(t.server).get('/api/health');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const reused = await request(t.server).get('/api/health').set('x-request-id', 'trace-abc-12345');
    expect(reused.headers['x-request-id']).toBe('trace-abc-12345');

    const rejected = await request(t.server)
      .get('/api/health')
      .set('x-request-id', 'bad id with spaces <script>');
    expect(rejected.headers['x-request-id']).not.toContain('<script>');
  });

  it('returns unknown routes in the standard error format with the request id', async () => {
    const res = await request(t.server)
      .get('/api/does-not-exist?x=1')
      .set('x-request-id', 'req-0001-test')
      .expect(404);
    expect(res.body).toEqual({
      statusCode: 404,
      message: 'Cannot GET /api/does-not-exist?x=1',
      path: '/api/does-not-exist',
      requestId: 'req-0001-test',
      timestamp: expect.any(String),
    });
  });

  it('sets security headers (helmet) and an allow-listed CORS policy', async () => {
    const res = await request(t.server).get('/api/health').set('Origin', t.config.webUrl);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['access-control-allow-origin']).toBe(t.config.webUrl);
    expect(res.headers['access-control-allow-credentials']).toBe('true');

    const foreign = await request(t.server).get('/api/health').set('Origin', 'https://evil.example');
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects JSON bodies over 1 MB with 413', async () => {
    const res = await request(t.server)
      .post('/api/auth/register')
      .set('Origin', t.config.webUrl)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'x'.repeat(1_100_000) }))
      .expect(413);
    expect(res.body.statusCode).toBe(413);
  });

  it('rejects malformed JSON with 400, not 500', async () => {
    const res = await request(t.server)
      .post('/api/auth/login')
      .set('Origin', t.config.webUrl)
      .set('Content-Type', 'application/json')
      .send('{"email": "broken"')
      .expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, path: '/api/auth/login' });
  });

  it('serves the OpenAPI document with both auth schemes', async () => {
    const res = await request(t.server).get('/api/docs-json').expect(200);
    const doc = res.body as {
      paths: Record<string, unknown>;
      components: { securitySchemes: Record<string, unknown> };
    };
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/api/auth/login', '/api/projects', '/api/suites/{id}/import']),
    );
    expect(Object.keys(doc.components.securitySchemes)).toEqual(
      expect.arrayContaining(['session', 'apiKey']),
    );
  });
});

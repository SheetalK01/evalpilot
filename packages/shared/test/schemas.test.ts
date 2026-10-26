import { describe, expect, it } from 'vitest';
import {
  apiKeyDisplayPrefix,
  createApiKeySchema,
  createProjectSchema,
  createRunSchema,
  createSuiteSchema,
  createTargetSchema,
  createTestCaseSchema,
  ingestTracesSchema,
  isApiKeyFormat,
  loginSchema,
  maskHeaders,
  maskHeaderValue,
  normalizeTraceIngest,
  paginationQuerySchema,
  parseRoomName,
  registerSchema,
  reorderCasesSchema,
  roomName,
  updateSuiteSchema,
  updateTargetSchema,
  usageQuerySchema,
} from '../src';

describe('auth schemas', () => {
  it('normalises email to lower case', () => {
    const parsed = registerSchema.parse({ name: ' Ada ', email: 'Ada@Example.COM', password: 'secret123' });
    expect(parsed).toEqual({ name: 'Ada', email: 'ada@example.com', password: 'secret123' });
  });

  it.each([
    ['short password', { name: 'A', email: 'a@b.co', password: 'a1' }],
    ['password without digits', { name: 'A', email: 'a@b.co', password: 'abcdefgh' }],
    ['password without letters', { name: 'A', email: 'a@b.co', password: '12345678' }],
    ['invalid email', { name: 'A', email: 'not-an-email', password: 'abcdefg1' }],
    ['blank name', { name: '   ', email: 'a@b.co', password: 'abcdefg1' }],
  ])('rejects registration with %s', (_name, input) => {
    expect(registerSchema.safeParse(input).success).toBe(false);
  });

  it('does not apply strength rules on login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});

describe('project and api key schemas', () => {
  it('validates project names', () => {
    expect(createProjectSchema.safeParse({ name: 'ShopSphere' }).success).toBe(true);
    expect(createProjectSchema.safeParse({ name: '' }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: 'x'.repeat(81) }).success).toBe(false);
  });

  it('validates api key names and format', () => {
    expect(createApiKeySchema.safeParse({ name: 'CI' }).success).toBe(true);
    expect(isApiKeyFormat(`ep_live_${'a'.repeat(32)}`)).toBe(true);
    expect(isApiKeyFormat('ep_test_abc')).toBe(false);
    expect(apiKeyDisplayPrefix(`ep_live_ab12${'z'.repeat(30)}`)).toBe('ep_live_ab12');
  });
});

describe('target schemas', () => {
  const http = {
    type: 'HTTP',
    name: 'Prod bot',
    url: 'https://bot.example.com/chat',
    bodyTemplate: '{"message":"{{input}}"}',
  };

  it('applies defaults to HTTP targets', () => {
    expect(createTargetSchema.parse(http)).toMatchObject({
      method: 'POST',
      headers: {},
      responsePath: '$',
      timeoutMs: 15000,
    });
  });

  it('accepts a ShopBot target with only a name', () => {
    expect(createTargetSchema.parse({ type: 'SHOPBOT', name: 'ShopBot' })).toMatchObject({ type: 'SHOPBOT' });
  });

  it('accepts GET targets with the placeholder in the URL', () => {
    expect(
      createTargetSchema.safeParse({
        ...http,
        method: 'GET',
        url: 'https://x.dev/ask?q={{input}}',
        bodyTemplate: undefined,
      }).success,
    ).toBe(true);
    expect(
      createTargetSchema.safeParse({
        ...http,
        method: 'GET',
        url: 'https://x.dev/ask',
        bodyTemplate: undefined,
      }).success,
    ).toBe(false);
  });

  it.each([
    ['missing placeholder', { ...http, bodyTemplate: '{"message":"hi"}' }],
    ['non-http scheme', { ...http, url: 'file:///etc/passwd' }],
    ['credentials in URL', { ...http, url: 'https://user:pass@bot.example.com' }],
    ['timeout too long', { ...http, timeoutMs: 120000 }],
    ['invalid header name', { ...http, headers: { 'bad header': 'x' } }],
    [
      'too many headers',
      { ...http, headers: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`h${i}`, 'v'])) },
    ],
  ])('rejects %s', (_name, input) => {
    expect(createTargetSchema.safeParse(input).success).toBe(false);
  });

  it('allows partial updates', () => {
    expect(updateTargetSchema.safeParse({ timeoutMs: 5000 }).success).toBe(true);
  });

  it('masks header values', () => {
    expect(maskHeaderValue('abc')).toBe('••••');
    expect(maskHeaderValue('Bearer sk-1234567890')).toBe('••••••••7890');
    expect(maskHeaders({ Authorization: 'Bearer secret-token' })).toEqual({ Authorization: '••••••••oken' });
  });
});

describe('suite and test case schemas', () => {
  it('defaults the pass threshold to 0.9', () => {
    expect(createSuiteSchema.parse({ name: 'Core' }).passThreshold).toBe(0.9);
    expect(createSuiteSchema.safeParse({ name: 'Core', passThreshold: 1.5 }).success).toBe(false);
  });

  it('lets an update clear the target', () => {
    expect(updateSuiteSchema.parse({ targetId: null })).toEqual({ targetId: null });
  });

  it('validates test cases and tags', () => {
    const base = { name: 'Refund', input: 'Can I return?', checks: [{ type: 'contains', value: 'refund' }] };
    expect(createTestCaseSchema.parse(base).tags).toEqual([]);
    expect(createTestCaseSchema.safeParse({ ...base, tags: ['smoke', 'refunds-v2'] }).success).toBe(true);
    expect(createTestCaseSchema.safeParse({ ...base, tags: ['has space'] }).success).toBe(false);
    expect(createTestCaseSchema.safeParse({ ...base, checks: [] }).success).toBe(false);
  });

  it('requires unique ids when reordering', () => {
    expect(reorderCasesSchema.safeParse({ ids: ['a', 'b'] }).success).toBe(true);
    expect(reorderCasesSchema.safeParse({ ids: ['a', 'a'] }).success).toBe(false);
  });
});

describe('run, pagination and usage schemas', () => {
  it('normalises commit SHAs', () => {
    expect(createRunSchema.parse({ commitSha: 'ABCDEF1' }).commitSha).toBe('abcdef1');
    expect(createRunSchema.safeParse({ commitSha: 'xyz' }).success).toBe(false);
  });

  it('coerces and bounds pagination', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(paginationQuerySchema.parse({ limit: '50' }).limit).toBe(50);
    expect(paginationQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('defaults usage range to 24h', () => {
    expect(usageQuerySchema.parse({}).range).toBe('24h');
    expect(usageQuerySchema.safeParse({ range: '1y' }).success).toBe(false);
  });
});

describe('trace ingestion schema', () => {
  const trace = { name: 'shopbot.chat', latencyMs: 420, model: 'claude-opus-5-5' };

  it('accepts a single trace and defaults status to OK', () => {
    const parsed = ingestTracesSchema.parse(trace);
    expect(normalizeTraceIngest(parsed)).toEqual([{ ...trace, status: 'OK' }]);
  });

  it('accepts a batch of up to 100', () => {
    const parsed = ingestTracesSchema.parse({ traces: Array.from({ length: 100 }, () => trace) });
    expect(normalizeTraceIngest(parsed)).toHaveLength(100);
    expect(ingestTracesSchema.safeParse({ traces: Array.from({ length: 101 }, () => trace) }).success).toBe(
      false,
    );
  });

  it.each([
    ['negative latency', { ...trace, latencyMs: -1 }],
    ['bad status', { ...trace, status: 'WARN' }],
    ['bad timestamp', { ...trace, startedAt: 'yesterday' }],
    ['nested metadata', { ...trace, metadata: { a: { b: 1 } } }],
  ])('rejects %s', (_name, input) => {
    expect(ingestTracesSchema.safeParse(input).success).toBe(false);
  });

  it('accepts ISO timestamps with offsets', () => {
    expect(ingestTracesSchema.safeParse({ ...trace, startedAt: '2026-10-26T10:00:00+05:30' }).success).toBe(
      true,
    );
  });
});

describe('realtime rooms', () => {
  it('builds and parses room names', () => {
    expect(roomName('run', 'abc123')).toBe('run:abc123');
    expect(parseRoomName('project:cm1x')).toEqual({ kind: 'project', id: 'cm1x' });
  });

  it.each(['run:', 'user:abc', 'run:abc:def', 'run:../../etc'])('rejects invalid room %s', (room) => {
    expect(parseRoomName(room)).toBeNull();
  });
});

import type { Target } from '@prisma/client';
import { buildTargetRequest } from './target-request';

const http = (overrides: Partial<Target> = {}) =>
  ({
    type: 'HTTP',
    url: 'https://bot.example.com/chat',
    method: 'POST',
    bodyTemplate: '{"message":"{{input}}"}',
    responsePath: '$.reply',
    ...overrides,
  }) as Target;

describe('buildTargetRequest', () => {
  it('posts to ShopBot from server config, ignoring stored fields', () => {
    expect(
      buildTargetRequest({ ...http(), type: 'SHOPBOT', url: null }, {}, 'Hi "there"', 'http://shopbot:4100/'),
    ).toEqual({
      url: 'http://shopbot:4100/chat',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"message":"Hi \\"there\\""}',
      responsePath: '$.reply',
      userDefined: false,
    });
  });

  it('renders the body template and adds a JSON content type', () => {
    const request = buildTargetRequest(http(), { Authorization: 'Bearer x' }, 'line1\nline2', '');
    expect(JSON.parse(request.body ?? '')).toEqual({ message: 'line1\nline2' });
    expect(request.headers).toEqual({ 'content-type': 'application/json', Authorization: 'Bearer x' });
    expect(request.userDefined).toBe(true);
  });

  it('keeps a user-supplied content type (any case)', () => {
    expect(buildTargetRequest(http(), { 'Content-Type': 'text/plain' }, 'x', '').headers).toEqual({
      'Content-Type': 'text/plain',
    });
  });

  it('puts the input in the URL for GET targets and sends no body', () => {
    const request = buildTargetRequest(
      http({ method: 'GET', url: 'https://bot.example.com/ask?q={{input}}', bodyTemplate: null }),
      {},
      'a & b',
      '',
    );
    expect(request).toMatchObject({
      url: 'https://bot.example.com/ask?q=a%20%26%20b',
      body: undefined,
      headers: {},
    });
  });

  it('falls back to a default template and the whole body as the answer', () => {
    const request = buildTargetRequest(http({ bodyTemplate: null, responsePath: null }), {}, 'hi', '');
    expect(request.body).toBe('{"input":"hi"}');
    expect(request.responsePath).toBe('$');
  });

  it('rejects an HTTP target without a URL', () => {
    expect(() => buildTargetRequest(http({ url: null }), {}, 'x', '')).toThrow('HTTP target has no URL');
  });
});

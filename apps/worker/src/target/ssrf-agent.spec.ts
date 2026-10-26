import type { LookupAddress } from 'node:dns';
import { guardedLookup, SsrfBlockedError } from './ssrf-agent';

type Addresses = LookupAddress[];

const mockLookup = jest.fn();
jest.mock('node:dns', () => ({
  ...jest.requireActual<object>('node:dns'),
  lookup: (...args: unknown[]) => mockLookup(...args) as unknown,
}));

function mockDns(result: Addresses | Error) {
  mockLookup.mockImplementation(
    (_host: string, _options: unknown, callback: (err: Error | null, addresses: Addresses) => void) => {
      if (result instanceof Error) callback(result, []);
      else callback(null, result);
    },
  );
}

const lookup = (options: { all?: boolean }) =>
  new Promise<{ error: Error | null; address: unknown; family?: number }>((resolve) => {
    guardedLookup('bot.example.com', options, (error: Error | null, address: unknown, family?: number) =>
      resolve({ error, address, family }),
    );
  });

describe('guardedLookup (DNS-rebinding safe)', () => {
  afterEach(() => mockLookup.mockReset());

  it('passes public addresses through, in both callback styles', async () => {
    mockDns([{ address: '93.184.216.34', family: 4 }]);
    expect(await lookup({ all: true })).toEqual({
      error: null,
      address: [{ address: '93.184.216.34', family: 4 }],
      family: undefined,
    });
    expect(await lookup({})).toEqual({ error: null, address: '93.184.216.34', family: 4 });
  });

  it.each([
    ['loopback', '127.0.0.1', 4],
    ['cloud metadata', '169.254.169.254', 4],
    ['private network', '10.0.0.7', 4],
    ['IPv6 loopback', '::1', 6],
  ])('blocks a public name that resolves to %s', async (_label, address, family) => {
    mockDns([
      { address: '93.184.216.34', family: 4 },
      { address, family },
    ]);
    const { error } = await lookup({ all: true });
    expect(error).toBeInstanceOf(SsrfBlockedError);
    expect(error?.message).toBe(`Blocked: bot.example.com resolves to private address ${address}`);
  });

  it('passes DNS errors through and handles an empty answer', async () => {
    mockDns(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }));
    expect((await lookup({})).error?.message).toContain('ENOTFOUND');
    mockDns([]);
    expect((await lookup({})).error?.message).toBe('No address for bot.example.com');
  });
});

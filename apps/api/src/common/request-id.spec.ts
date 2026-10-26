import type { IncomingMessage, ServerResponse } from 'node:http';
import { requestIdOf, resolveRequestId } from './request-id';

const call = (header?: string) => {
  const setHeader = jest.fn();
  const id = resolveRequestId(
    { headers: header ? { 'x-request-id': header } : {} } as IncomingMessage,
    { setHeader } as unknown as ServerResponse,
  );
  return { id, setHeader };
};

describe('resolveRequestId', () => {
  it('reuses a well-formed incoming id and echoes it', () => {
    const { id, setHeader } = call('upstream-req-42');
    expect(id).toBe('upstream-req-42');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'upstream-req-42');
  });

  it.each(['short', 'has spaces in it', 'x'.repeat(65), '<script>alert(1)</script>'])(
    'replaces unsafe id %j with a UUID',
    (header) => {
      expect(call(header).id).toMatch(/^[0-9a-f-]{36}$/);
    },
  );

  it('generates a UUID when none is sent', () => {
    expect(call().id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('requestIdOf', () => {
  it('reads the id or says unknown', () => {
    expect(requestIdOf({ id: 'abc' })).toBe('abc');
    expect(requestIdOf({})).toBe('unknown');
  });
});

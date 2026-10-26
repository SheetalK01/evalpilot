import { parseEnvelope } from './realtime-relay.service';
import { sessionTokenFromCookieHeader } from './session-token';

describe('sessionTokenFromCookieHeader', () => {
  it.each([
    [undefined, null],
    ['', null],
    ['theme=dark', null],
    ['ep_session=abc.def.ghi', 'abc.def.ghi'],
    ['theme=dark; ep_session=abc.def%3D%3D; other=1', 'abc.def=='],
    ['ep_session=', null],
    ['ep_session=%E0%A4%A', null],
  ])('%j → %j', (header, expected) => {
    expect(sessionTokenFromCookieHeader(header)).toBe(expected);
  });
});

describe('parseEnvelope', () => {
  it('accepts well-formed events for valid rooms', () => {
    expect(
      parseEnvelope(JSON.stringify({ room: 'run:abc', event: 'run.progress', payload: { done: 1 } })),
    ).toEqual({
      room: 'run:abc',
      event: 'run.progress',
      payload: { done: 1 },
    });
  });

  it.each([
    ['not json', 'nope'],
    ['an unknown room kind', JSON.stringify({ room: 'user:abc', event: 'run.progress' })],
    ['an unknown event', JSON.stringify({ room: 'run:abc', event: 'shell.exec' })],
    ['a missing room', JSON.stringify({ event: 'run.progress' })],
  ])('drops %s', (_label, message) => {
    expect(parseEnvelope(message)).toBeNull();
  });
});

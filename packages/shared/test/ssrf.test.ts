import { describe, expect, it } from 'vitest';
import {
  assessTargetUrl,
  isBlockedHostname,
  isPrivateAddress,
  isPrivateIPv4,
  isPrivateIPv6,
  parseIPv4,
  parseIPv6,
} from '../src';

describe('IPv4', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '198.18.0.1',
  ])('%s is private or reserved', (ip) => {
    expect(isPrivateIPv4(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '172.15.255.255', '192.169.0.1', '100.128.0.1'])(
    '%s is public',
    (ip) => {
      expect(isPrivateIPv4(ip)).toBe(false);
    },
  );

  it('parses strictly', () => {
    expect(parseIPv4('1.2.3')).toBeNull();
    expect(parseIPv4('1.2.3.256')).toBeNull();
    expect(parseIPv4('1.2.3.x')).toBeNull();
    expect(isPrivateIPv4('not-an-ip')).toBe(false);
  });
});

describe('IPv6', () => {
  it.each([
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '64:ff9b::a9fe:a9fe',
    '2001:db8::1',
    '[::1]',
    'fe80::1%en0',
  ])('%s is private or reserved', (ip) => {
    expect(isPrivateIPv6(ip)).toBe(true);
  });

  it.each(['2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8'])('%s is public', (ip) => {
    expect(isPrivateIPv6(ip)).toBe(false);
  });

  it('parses full and compressed forms', () => {
    expect(parseIPv6('2001:0db8:0000:0000:0000:0000:0000:0001')).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
    expect(parseIPv6('1::2::3')).toBeNull();
    expect(parseIPv6('1:2:3')).toBeNull();
    expect(parseIPv6('::ffff:999.1.1.1')).toBeNull();
    expect(parseIPv6('gggg::1')).toBeNull();
    expect(isPrivateIPv6('nope')).toBe(false);
  });
});

describe('isPrivateAddress', () => {
  it('handles both families and fails closed on garbage', () => {
    expect(isPrivateAddress('10.0.0.1')).toBe(true);
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('example.com')).toBe(true);
  });
});

describe('isBlockedHostname', () => {
  it.each([
    'localhost',
    'LOCALHOST.',
    'api.localhost',
    'printer.local',
    'metadata.google.internal',
    'db.localdomain',
  ])('%s is blocked', (host) => {
    expect(isBlockedHostname(host)).toBe(true);
  });

  it('allows public names', () => {
    expect(isBlockedHostname('api.example.com')).toBe(false);
  });
});

describe('assessTargetUrl', () => {
  const strict = { allowPrivate: false };

  it.each([
    ['http://127.0.0.1:4100/chat', 'private'],
    ['http://2130706433/', 'private'], // decimal form of 127.0.0.1, normalised by URL
    ['http://0x7f.0.0.1/', 'private'],
    ['http://[::1]/', 'private'],
    ['http://169.254.169.254/latest/meta-data', 'private'],
    ['http://localhost:3000', 'internal'],
    ['ftp://example.com', 'Only http'],
    ['http://user:pw@example.com', 'Credentials'],
    ['not a url', 'Invalid URL'],
  ])('blocks %s', (url, reason) => {
    const result = assessTargetUrl(url, strict);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain(reason);
  });

  it('allows public URLs', () => {
    expect(assessTargetUrl('https://api.example.com/chat', strict).ok).toBe(true);
    expect(assessTargetUrl('https://8.8.8.8/', strict).ok).toBe(true);
  });

  it('allows private targets when explicitly enabled (local development)', () => {
    expect(assessTargetUrl('http://localhost:4100/chat', { allowPrivate: true }).ok).toBe(true);
    expect(assessTargetUrl('file:///etc/passwd', { allowPrivate: true }).ok).toBe(false);
  });
});

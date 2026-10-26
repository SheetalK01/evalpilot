/**
 * Pure helpers for the SSRF guard. The worker resolves DNS and runs every resolved address
 * through `isPrivateAddress`, so a public hostname pointing at 127.0.0.1 is still blocked.
 */

type Cidr4 = [number, number, number, number, number];

const PRIVATE_V4: readonly Cidr4[] = [
  [0, 0, 0, 0, 8], // "this" network
  [10, 0, 0, 0, 8], // private
  [100, 64, 0, 0, 10], // carrier-grade NAT
  [127, 0, 0, 0, 8], // loopback
  [169, 254, 0, 0, 16], // link-local, incl. cloud metadata 169.254.169.254
  [172, 16, 0, 0, 12], // private
  [192, 0, 0, 0, 24], // IETF protocol assignments
  [192, 0, 2, 0, 24], // TEST-NET-1
  [192, 168, 0, 0, 16], // private
  [198, 18, 0, 0, 15], // benchmarking
  [198, 51, 100, 0, 24], // TEST-NET-2
  [203, 0, 113, 0, 24], // TEST-NET-3
  [224, 0, 0, 0, 4], // multicast
  [240, 0, 0, 0, 4], // reserved + broadcast
];

export function parseIPv4(value: string): number[] | null {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  return octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255) ? octets : null;
}

const toUint32 = (octets: readonly number[]) => octets.reduce((acc, octet) => acc * 256 + octet, 0);

function inCidr4(octets: readonly number[], [a, b, c, d, bits]: Cidr4): boolean {
  const size = 2 ** (32 - bits);
  return Math.floor(toUint32(octets) / size) === Math.floor(toUint32([a, b, c, d]) / size);
}

export function isPrivateIPv4(value: string): boolean {
  const octets = parseIPv4(value);
  if (!octets) return false;
  return PRIVATE_V4.some((cidr) => inCidr4(octets, cidr));
}

/** Expands an IPv6 address into 8 16-bit groups. Returns null if it is not valid IPv6. */
export function parseIPv6(value: string): number[] | null {
  let address = value.replace(/^\[|\]$/g, '').split('%')[0] ?? '';
  // Embedded IPv4 tail, e.g. ::ffff:127.0.0.1
  const v4Tail = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);
  if (v4Tail?.[1]) {
    const octets = parseIPv4(v4Tail[1]);
    if (!octets) return null;
    const [a = 0, b = 0, c = 0, d = 0] = octets;
    address = `${address.slice(0, -v4Tail[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string | undefined) => (part ? part.split(':') : []);
  const head = parse(halves[0]);
  const tail = parse(halves[1]);
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) return null;
  return groups.map((group) => parseInt(group, 16));
}

export function isPrivateIPv6(value: string): boolean {
  const groups = parseIPv6(value);
  if (!groups) return false;
  const [g0 = 0, g1 = 0, , , , g5 = 0, g6 = 0, g7 = 0] = groups;
  const first5Zero = groups.slice(0, 5).every((group) => group === 0);
  if (groups.every((group) => group === 0)) return true; // ::
  if (first5Zero && g5 === 0 && g6 === 0 && g7 === 1) return true; // ::1
  const embeddedV4 = `${g6 >> 8}.${g6 & 255}.${g7 >> 8}.${g7 & 255}`;
  if (first5Zero && g5 === 0xffff) return isPrivateIPv4(embeddedV4); // IPv4-mapped
  if (g0 === 0x64 && g1 === 0xff9b) return isPrivateIPv4(embeddedV4); // NAT64
  if ((g0 & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((g0 & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((g0 & 0xff00) === 0xff00) return true; // multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation
  return false;
}

/** True for private/reserved addresses, and for anything that is not a valid IP (fail closed). */
export function isPrivateAddress(ip: string): boolean {
  if (parseIPv4(ip)) return isPrivateIPv4(ip);
  if (parseIPv6(ip)) return isPrivateIPv6(ip);
  return true;
}

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain'];

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return host === 'localhost' || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export type UrlAssessment = { ok: true; url: URL } | { ok: false; reason: string };

/**
 * Static checks on a target URL before any DNS lookup: scheme, credentials, blocked hostnames
 * and literal private IPs. `allowPrivate` is for local development (ALLOW_PRIVATE_TARGETS=true).
 */
export function assessTargetUrl(rawUrl: string, options: { allowPrivate: boolean }): UrlAssessment {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    return { ok: false, reason: 'Only http and https are allowed' };
  if (url.username || url.password) return { ok: false, reason: 'Credentials in the URL are not allowed' };
  if (options.allowPrivate) return { ok: true, url };
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isBlockedHostname(host)) return { ok: false, reason: `Host "${host}" is internal` };
  if ((parseIPv4(host) || parseIPv6(host)) && isPrivateAddress(host)) {
    return { ok: false, reason: `Address ${host} is private or reserved` };
  }
  return { ok: true, url };
}

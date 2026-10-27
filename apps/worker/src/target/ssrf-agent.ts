import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import type { LookupFunction } from 'node:net';
import { isPrivateAddress } from '@evalpilot/shared';
import { Agent } from 'undici';

export class SsrfBlockedError extends Error {
  readonly code = 'SSRF_BLOCKED';

  constructor(hostname: string, address: string) {
    super(`Blocked: ${hostname} resolves to private address ${address}`);
  }
}

/**
 * DNS lookup used for every outgoing connection to a user-defined target. It rejects the
 * connection if *any* resolved address is private, at connect time, so a public hostname that
 * re-binds to 127.0.0.1 or 169.254.169.254 is still blocked. (Literal IPs skip DNS and are
 * checked earlier by `assessTargetUrl`.)
 */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) {
      callback(error, '', 0);
      return;
    }
    const blocked = addresses.find((entry) => isPrivateAddress(entry.address));
    if (blocked) {
      callback(new SsrfBlockedError(hostname, blocked.address), '', 0);
      return;
    }
    if (options.all) {
      (callback as unknown as (err: null, addresses: LookupAddress[]) => void)(null, addresses);
      return;
    }
    const [first] = addresses;
    if (!first) {
      callback(Object.assign(new Error(`No address for ${hostname}`), { code: 'ENOTFOUND' }), '', 0);
      return;
    }
    callback(null, first.address, first.family);
  });
};

export function createGuardedAgent(): Agent {
  return new Agent({ connect: { lookup: guardedLookup } });
}

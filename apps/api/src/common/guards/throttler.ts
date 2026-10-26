import { createHash } from 'node:crypto';
import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, type ThrottlerModuleOptions } from '@nestjs/throttler';
import type { AppConfig } from '../../config/env';
import { RATE_LIMIT_BUCKET, type RateLimitBucket } from '../decorators/rate-limit.decorator';

const reflector = new Reflector();
const MINUTE = 60_000;

function bucketOf(context: ExecutionContext): RateLimitBucket {
  return (
    reflector.getAllAndOverride<RateLimitBucket | undefined>(RATE_LIMIT_BUCKET, [
      context.getHandler(),
      context.getClass(),
    ]) ?? 'default'
  );
}

/** Three buckets; each route falls into exactly one of them. */
export function throttlerOptions(config: AppConfig): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        name: 'default',
        ttl: MINUTE,
        limit: config.rateLimits.default,
        skipIf: (ctx) => bucketOf(ctx) !== 'default',
      },
      { name: 'auth', ttl: MINUTE, limit: config.rateLimits.auth, skipIf: (ctx) => bucketOf(ctx) !== 'auth' },
      { name: 'v1', ttl: MINUTE, limit: config.rateLimits.v1, skipIf: (ctx) => bucketOf(ctx) !== 'v1' },
    ],
  };
}

interface TrackedRequest {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/**
 * Who a request counts against: API-key traffic per key, login/register attempts per IP + email
 * (slows down credential stuffing without locking out a whole office), everything else per IP.
 */
export function trackerFor(req: TrackedRequest): string {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && /^bearer\s+\S+/i.test(auth)) {
    return `key:${createHash('sha256').update(auth).digest('hex').slice(0, 16)}`;
  }
  const ip = req.ip ?? 'unknown';
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? `ip:${ip}|email:${email.trim().toLowerCase()}` : `ip:${ip}`;
}

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(trackerFor(req as unknown as TrackedRequest));
  }
}

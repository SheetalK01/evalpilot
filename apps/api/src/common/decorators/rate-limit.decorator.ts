import { SetMetadata } from '@nestjs/common';

export type RateLimitBucket = 'default' | 'auth' | 'v1';
export const RATE_LIMIT_BUCKET = 'evalpilot:rateLimitBucket';

/** Puts a route in a stricter rate-limit bucket (see `throttler.ts`). */
export const RateLimit = (bucket: Exclude<RateLimitBucket, 'default'>) =>
  SetMetadata(RATE_LIMIT_BUCKET, bucket);

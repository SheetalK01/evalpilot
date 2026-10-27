/**
 * Docker HEALTHCHECK for the worker: healthy while its heartbeat key in Redis is fresh.
 * Exits 0 (healthy) or 1. Reads only REDIS_URL and REDIS_PREFIX.
 */
import { redisKeys } from '@evalpilot/server-core';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  connectTimeout: 3000,
});

redis
  .connect()
  .then(() => redis.exists(redisKeys(process.env.REDIS_PREFIX ?? 'evalpilot').workerHeartbeat))
  .then(
    (found) => {
      redis.disconnect();
      process.exit(found === 1 ? 0 : 1);
    },
    () => process.exit(1),
  );

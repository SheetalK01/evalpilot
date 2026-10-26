import { Injectable } from '@nestjs/common';
import { type HealthResponse, WORKER_HEARTBEAT_KEY } from '@evalpilot/shared';
import type { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '../redis/redis.module';

type State = 'up' | 'down';
const CHECK_TIMEOUT_MS = 1500;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('timeout'));
      }, CHECK_TIMEOUT_MS).unref();
    }),
  ]);
}

async function probe(check: () => Promise<boolean>): Promise<State> {
  try {
    return (await withTimeout(check())) ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthResponse> {
    const [db, redis, worker] = await Promise.all([
      probe(async () => (await this.prisma.$queryRaw<unknown[]>`SELECT 1`).length === 1),
      probe(async () => {
        await this.redis.ping();
        return true;
      }),
      probe(async () => (await this.redis.exists(WORKER_HEARTBEAT_KEY)) === 1),
    ]);
    return {
      // The API can serve requests without the worker; runs just stay queued.
      status: db === 'up' && redis === 'up' ? 'ok' : 'degraded',
      checks: { api: 'up', db, redis, worker },
      version: process.env.npm_package_version ?? '0.1.0',
      time: new Date().toISOString(),
    };
  }
}

import { Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import {
  type AppConfig,
  InjectConfig,
  InjectRedis,
  redisKeys,
  WORKER_HEARTBEAT_TTL_SECONDS,
} from '@evalpilot/server-core';
import type { Redis } from 'ioredis';

/** Keeps a short-lived Redis key alive so the API's /health (and the status bar LED) can see the worker. */
@Injectable()
export class HeartbeatService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;
  private readonly key: string;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectConfig() config: AppConfig,
  ) {
    this.key = redisKeys(config.redisPrefix).workerHeartbeat;
  }

  async beat(): Promise<void> {
    await this.redis.set(this.key, new Date().toISOString(), 'EX', WORKER_HEARTBEAT_TTL_SECONDS);
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.beat();
    this.timer = setInterval(
      () => {
        void this.beat().catch(() => undefined);
      },
      (WORKER_HEARTBEAT_TTL_SECONDS * 1000) / 3,
    );
    this.timer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.redis.del(this.key).catch(() => undefined);
  }
}

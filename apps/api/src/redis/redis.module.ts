import { Global, Inject, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../config/env';

export const REDIS = Symbol('REDIS');
export const InjectRedis = () => Inject(REDIS);

@Injectable()
class RedisLifecycle implements OnModuleDestroy {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new Redis(config.redisUrl, { maxRetriesPerRequest: 2, connectTimeout: 2000 }),
    },
    RedisLifecycle,
  ],
  exports: [REDIS],
})
export class RedisModule {}

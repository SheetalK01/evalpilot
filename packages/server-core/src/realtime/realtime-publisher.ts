import { Global, Injectable, Module } from '@nestjs/common';
import {
  type RealtimeEnvelope,
  type RealtimeEvent,
  type RealtimePayloads,
  roomName,
  type RoomKind,
} from '@evalpilot/shared';
import type { Redis } from 'ioredis';
import { InjectConfig } from '../config/config.module';
import type { AppConfig } from '../config/env';
import { redisKeys } from '../redis/keys';
import { InjectRedis } from '../redis/redis.module';

/** Publishes live events on Redis; the API's Socket.IO gateway relays them to the right room. */
@Injectable()
export class RealtimePublisher {
  private readonly channel: string;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectConfig() config: AppConfig,
  ) {
    this.channel = redisKeys(config.redisPrefix).realtimeChannel;
  }

  async publish<E extends RealtimeEvent>(
    kind: RoomKind,
    id: string,
    event: E,
    payload: RealtimePayloads[E],
  ): Promise<void> {
    const envelope: RealtimeEnvelope<RealtimePayloads[E]> = { room: roomName(kind, id), event, payload };
    await this.redis.publish(this.channel, JSON.stringify(envelope));
  }
}

@Global()
@Module({ providers: [RealtimePublisher], exports: [RealtimePublisher] })
export class RealtimePublisherModule {}

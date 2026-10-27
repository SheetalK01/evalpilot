import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { parseRoomName, REALTIME_EVENTS, type RealtimeEnvelope } from '@evalpilot/shared';
import { type AppConfig, InjectConfig, InjectRedis, redisKeys } from '@evalpilot/server-core';
import type { Redis } from 'ioredis';
import { RealtimeGateway } from './realtime.gateway';

const KNOWN_EVENTS = new Set<string>(Object.values(REALTIME_EVENTS));

export function parseEnvelope(message: string): RealtimeEnvelope | null {
  try {
    const value = JSON.parse(message) as Partial<RealtimeEnvelope>;
    if (typeof value.room !== 'string' || !parseRoomName(value.room)) return null;
    if (typeof value.event !== 'string' || !KNOWN_EVENTS.has(value.event)) return null;
    return { room: value.room, event: value.event, payload: value.payload };
  } catch {
    return null;
  }
}

/** Subscribes to the Redis channel the worker publishes on and forwards each event to its room. */
@Injectable()
export class RealtimeRelay implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeRelay.name);
  private subscriber: Redis | null = null;
  private readonly channel: string;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectConfig() config: AppConfig,
    private readonly gateway: RealtimeGateway,
  ) {
    this.channel = redisKeys(config.redisPrefix).realtimeChannel;
  }

  async onModuleInit(): Promise<void> {
    this.subscriber = this.redis.duplicate();
    this.subscriber.on('message', (_channel: string, message: string) => {
      const envelope = parseEnvelope(message);
      if (!envelope) {
        this.logger.warn('Dropped a malformed realtime message');
        return;
      }
      this.gateway.emitToRoom(envelope.room, envelope.event, envelope.payload);
    });
    await this.subscriber.subscribe(this.channel);
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit().catch(() => undefined);
  }
}

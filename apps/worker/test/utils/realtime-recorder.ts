import type { RealtimeEnvelope } from '@evalpilot/shared';
import { type AppConfig, redisKeys } from '@evalpilot/server-core';
import { Redis } from 'ioredis';

/** Subscribes to the realtime channel and records every event, to assert what browsers would see. */
export async function recordRealtime(config: AppConfig) {
  const subscriber = new Redis(config.redisUrl);
  const events: RealtimeEnvelope[] = [];
  subscriber.on('message', (_channel: string, message: string) =>
    events.push(JSON.parse(message) as RealtimeEnvelope),
  );
  await subscriber.subscribe(redisKeys(config.redisPrefix).realtimeChannel);
  return {
    events,
    forRoom: (room: string) => events.filter((event) => event.room === room),
    close: () => subscriber.quit(),
  };
}

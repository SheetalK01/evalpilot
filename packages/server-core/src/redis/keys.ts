/** Every Redis name EvalPilot uses, under one prefix (so tests and dev never collide). */
export interface RedisKeys {
  /** Key the worker refreshes while alive; `/health` reads it. */
  workerHeartbeat: string;
  /** Pub/sub channel: worker publishes progress, the API gateway relays it to browsers. */
  realtimeChannel: string;
  /** BullMQ key prefix for all queues. */
  bullPrefix: string;
}

export const WORKER_HEARTBEAT_TTL_SECONDS = 30;

export function redisKeys(prefix: string): RedisKeys {
  return {
    workerHeartbeat: `${prefix}:worker:heartbeat`,
    realtimeChannel: `${prefix}:realtime`,
    bullPrefix: `${prefix}:bull`,
  };
}

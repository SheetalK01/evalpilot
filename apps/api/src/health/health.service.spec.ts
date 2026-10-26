import type { Redis } from 'ioredis';
import type { AppConfig, PrismaService } from '@evalpilot/server-core';
import { HealthService } from './health.service';

function service({
  db,
  ping,
  heartbeat,
}: {
  db: () => Promise<unknown[]>;
  ping: () => Promise<string>;
  heartbeat: () => Promise<number>;
}) {
  const prisma = { $queryRaw: jest.fn(db) } as unknown as PrismaService;
  const redis = { ping: jest.fn(ping), exists: jest.fn(heartbeat) } as unknown as Redis;
  return new HealthService(prisma, redis, { redisPrefix: 'evalpilot-test' } as AppConfig);
}

describe('HealthService', () => {
  it('is ok when DB and Redis are up, and reports the worker heartbeat', async () => {
    const result = await service({
      db: () => Promise.resolve([1]),
      ping: () => Promise.resolve('PONG'),
      heartbeat: () => Promise.resolve(1),
    }).check();
    expect(result.status).toBe('ok');
    expect(result.checks).toEqual({ api: 'up', db: 'up', redis: 'up', worker: 'up' });
  });

  it('stays ok when only the worker is down (runs just queue up)', async () => {
    const result = await service({
      db: () => Promise.resolve([1]),
      ping: () => Promise.resolve('PONG'),
      heartbeat: () => Promise.resolve(0),
    }).check();
    expect(result.status).toBe('ok');
    expect(result.checks.worker).toBe('down');
  });

  it('is degraded when the database or Redis fails', async () => {
    const result = await service({
      db: () => Promise.reject(new Error('ECONNREFUSED')),
      ping: () => Promise.reject(new Error('ECONNREFUSED')),
      heartbeat: () => Promise.reject(new Error('ECONNREFUSED')),
    }).check();
    expect(result.status).toBe('degraded');
    expect(result.checks).toEqual({ api: 'up', db: 'down', redis: 'down', worker: 'down' });
  });

  it('treats a hanging dependency as down after the timeout', async () => {
    jest.useFakeTimers();
    try {
      const pending = service({
        db: () => new Promise(() => undefined),
        ping: () => Promise.resolve('PONG'),
        heartbeat: () => Promise.resolve(1),
      }).check();
      await jest.advanceTimersByTimeAsync(2000);
      const result = await pending;
      expect(result.checks.db).toBe('down');
      expect(result.status).toBe('degraded');
    } finally {
      jest.useRealTimers();
    }
  });
});

import type { AppConfig } from '../config/env';
import { bullConnection } from './queues.module';

const withUrl = (redisUrl: string) => bullConnection({ redisUrl } as AppConfig);

describe('bullConnection', () => {
  it('turns a Redis URL into BullMQ connection options', () => {
    expect(withUrl('redis://127.0.0.1:6379')).toEqual({
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
    });
  });

  it('keeps credentials, database and TLS', () => {
    expect(withUrl('rediss://user:p%40ss@cache.example.com:6380/2')).toEqual({
      host: 'cache.example.com',
      port: 6380,
      username: 'user',
      password: 'p@ss',
      db: 2,
      tls: {},
      maxRetriesPerRequest: null,
    });
  });

  it('defaults the port', () => {
    expect(withUrl('redis://host.docker.internal')).toMatchObject({
      host: 'host.docker.internal',
      port: 6379,
    });
  });
});

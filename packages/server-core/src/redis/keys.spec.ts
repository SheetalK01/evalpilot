import { redisKeys } from './keys';

describe('redisKeys', () => {
  it('puts every name under the prefix', () => {
    expect(redisKeys('evalpilot')).toEqual({
      workerHeartbeat: 'evalpilot:worker:heartbeat',
      realtimeChannel: 'evalpilot:realtime',
      bullPrefix: 'evalpilot:bull',
    });
  });
});

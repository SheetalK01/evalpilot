import { SerialQueue } from './serial';

describe('SerialQueue', () => {
  it('runs steps one at a time in the order they were queued', async () => {
    const queue = new SerialQueue();
    const log: string[] = [];
    const slow = queue.run(async () => {
      log.push('a:start');
      await new Promise((resolve) => setTimeout(resolve, 5));
      log.push('a:end');
    });
    const fast = queue.run(() => {
      log.push('b');
      return Promise.resolve();
    });
    await Promise.all([slow, fast]);
    expect(log).toEqual(['a:start', 'a:end', 'b']);
  });

  it('keeps going after a failed step and reports the failure to its caller', async () => {
    const queue = new SerialQueue();
    await expect(queue.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    let ran = false;
    await queue.run(() => {
      ran = true;
      return Promise.resolve();
    });
    expect(ran).toBe(true);
  });
});

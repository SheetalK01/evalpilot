import { forEachConcurrent } from './concurrency';

describe('forEachConcurrent', () => {
  it('never runs more than `limit` tasks at once and processes every item', async () => {
    let active = 0;
    let peak = 0;
    const seen: number[] = [];
    await forEachConcurrent([1, 2, 3, 4, 5, 6, 7], 3, async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setImmediate(resolve));
      seen.push(item);
      active -= 1;
    });
    expect(peak).toBe(3);
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('starts items in order and passes their index', async () => {
    const started: [string, number][] = [];
    await forEachConcurrent(['a', 'b', 'c'], 2, (item, index) => {
      started.push([item, index]);
      return Promise.resolve();
    });
    expect(started).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
  });

  it('handles an empty list and rejects when a task fails', async () => {
    await expect(forEachConcurrent([], 4, () => Promise.reject(new Error('never')))).resolves.toBeUndefined();
    await expect(forEachConcurrent([1], 4, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
  });
});

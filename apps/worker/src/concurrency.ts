/** Runs `task` for every item with at most `limit` running at once. Resolves when all are done. */
export async function forEachConcurrent<T>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await task(items[index] as T, index);
    }
  });
  await Promise.all(lanes);
}

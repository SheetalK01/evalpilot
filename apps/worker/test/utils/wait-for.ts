/** Polls until `check` returns a truthy value (no fixed sleeps). Fails with `message` after `timeoutMs`. */
export async function waitFor<T>(
  check: () => Promise<T | null | undefined | false>,
  message: string,
  timeoutMs = 15_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting: ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

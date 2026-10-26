/**
 * Runs async steps one after another, in the order they were queued. Used to publish live events
 * from concurrent lanes in a consistent order (progress counts never go backwards).
 */
export class SerialQueue {
  private tail: Promise<void> = Promise.resolve();

  run(step: () => Promise<void>): Promise<void> {
    const next = this.tail.then(step);
    // Keep the chain alive even if a step fails; the caller still sees the error.
    this.tail = next.catch(() => undefined);
    return next;
  }
}

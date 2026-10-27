import { expect } from '@playwright/test';
import type { z } from 'zod';

/** Asserts that `value` matches a shared response schema and returns it typed. */
export function expectSchema<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value);
  expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues, null, 2)).toBe(true);
  return parsed.data as z.infer<T>;
}

/** Every error response has this shape (see ApiErrorBody in @evalpilot/shared). */
export function expectApiError(body: unknown, statusCode: number): void {
  expect(body).toMatchObject({
    statusCode,
    message: expect.any(String),
    path: expect.stringMatching(/^\/api\//),
    requestId: expect.any(String),
    timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
  });
}

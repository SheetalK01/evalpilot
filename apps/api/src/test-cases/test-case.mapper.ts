import type { TestCase } from '@prisma/client';
import { type Check, checksSchema, type TestCaseResponse } from '@evalpilot/shared';

/** Checks are validated on write; anything unreadable in the DB is dropped rather than crashing a page. */
export function parseStoredChecks(value: unknown): Check[] {
  const parsed = checksSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function parseStoredTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : [];
}

export function toTestCaseResponse(testCase: TestCase): TestCaseResponse {
  return {
    id: testCase.id,
    suiteId: testCase.suiteId,
    name: testCase.name,
    input: testCase.input,
    checks: parseStoredChecks(testCase.checksJson),
    tags: parseStoredTags(testCase.tags),
    position: testCase.position,
    createdAt: testCase.createdAt.toISOString(),
    updatedAt: testCase.updatedAt.toISOString(),
  };
}

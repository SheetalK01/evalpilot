import { z } from 'zod';
import { HTTP_METHODS, RUN_STATUSES, TARGET_TYPES } from '../enums';
import { checkSchema } from './checks';

/**
 * Response shapes returned by the API. The API uses them for Swagger docs, the web app and
 * SDK use the inferred types, and contract tests use them to check payloads.
 * Dates are ISO-8601 strings.
 */

const isoDate = z.iso.datetime();

export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}

export const publicUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: isoDate,
});
export type PublicUserResponse = z.infer<typeof publicUserSchema>;

export const authProvidersSchema = z.object({ github: z.boolean() });

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  suiteCount: z.number().int(),
  targetCount: z.number().int(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type ProjectResponse = z.infer<typeof projectSchema>;

export const apiKeySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  /** Display-safe start of the key, e.g. `ep_live_ab12`. */
  prefix: z.string(),
  lastUsedAt: isoDate.nullable(),
  revokedAt: isoDate.nullable(),
  createdAt: isoDate,
});
export type ApiKeyResponse = z.infer<typeof apiKeySchema>;

/** Only returned once, when the key is created. */
export const createdApiKeySchema = apiKeySchema.extend({ key: z.string() });
export type CreatedApiKeyResponse = z.infer<typeof createdApiKeySchema>;

export const targetSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  type: z.enum(TARGET_TYPES),
  /** Null for the built-in ShopBot target (its URL comes from server config). */
  url: z.string().nullable(),
  method: z.enum(HTTP_METHODS),
  /** Header values are masked, e.g. `••••••••abcd`. */
  headers: z.record(z.string(), z.string()),
  bodyTemplate: z.string().nullable(),
  responsePath: z.string().nullable(),
  timeoutMs: z.number().int(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type TargetResponse = z.infer<typeof targetSchema>;

export const runSummarySchema = z.object({
  id: z.string(),
  status: z.enum(RUN_STATUSES),
  passRate: z.number().nullable(),
  createdAt: isoDate,
});
export type RunSummaryResponse = z.infer<typeof runSummarySchema>;

export const suiteSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  targetId: z.string().nullable(),
  target: z.object({ id: z.string(), name: z.string(), type: z.enum(TARGET_TYPES) }).nullable(),
  name: z.string(),
  description: z.string().nullable(),
  passThreshold: z.number(),
  caseCount: z.number().int(),
  lastRun: runSummarySchema.nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type SuiteResponse = z.infer<typeof suiteSchema>;

export const testCaseSchema = z.object({
  id: z.string(),
  suiteId: z.string(),
  name: z.string(),
  input: z.string(),
  checks: z.array(checkSchema),
  tags: z.array(z.string()),
  position: z.number().int(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type TestCaseResponse = z.infer<typeof testCaseSchema>;

export const csvImportResultSchema = z.object({
  imported: z.number().int(),
  errors: z.array(z.object({ row: z.number().int(), message: z.string() })),
});
export type CsvImportResultResponse = z.infer<typeof csvImportResultSchema>;

export const HEALTH_STATES = ['up', 'down'] as const;
export const healthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  checks: z.object({
    api: z.enum(HEALTH_STATES),
    db: z.enum(HEALTH_STATES),
    redis: z.enum(HEALTH_STATES),
    worker: z.enum(HEALTH_STATES),
  }),
  version: z.string(),
  time: isoDate,
});
export type HealthResponse = z.infer<typeof healthSchema>;

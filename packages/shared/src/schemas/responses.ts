import { z } from 'zod';
import {
  ATTACK_CATEGORIES,
  HTTP_METHODS,
  REDTEAM_STATUSES,
  RESULT_STATUSES,
  RUN_STATUSES,
  RUN_TRIGGERS,
  SEVERITIES,
  TARGET_TYPES,
} from '../enums';
import { checkResultSchema, checkSchema } from './checks';

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

// ─── Runs ───────────────────────────────────────────────────────────────────

export const runSchema = z.object({
  id: z.string(),
  suiteId: z.string(),
  suiteName: z.string(),
  projectId: z.string(),
  status: z.enum(RUN_STATUSES),
  trigger: z.enum(RUN_TRIGGERS),
  commitSha: z.string().nullable(),
  total: z.number().int(),
  passed: z.number().int(),
  failed: z.number().int(),
  passRate: z.number().nullable(),
  passThreshold: z.number(),
  avgLatencyMs: z.number().int().nullable(),
  totalTokens: z.number().int(),
  estCostUsd: z.number(),
  startedAt: isoDate.nullable(),
  finishedAt: isoDate.nullable(),
  error: z.string().nullable(),
  createdAt: isoDate,
});
export type RunResponse = z.infer<typeof runSchema>;

/** A run in a list, plus a compact status strip ("P", "F", "E" per case, in suite order). */
export const runListItemSchema = runSchema.extend({ strip: z.string() });
export type RunListItemResponse = z.infer<typeof runListItemSchema>;

export const testResultSchema = z.object({
  id: z.string(),
  runId: z.string(),
  testCaseId: z.string().nullable(),
  caseName: z.string(),
  position: z.number().int(),
  status: z.enum(RESULT_STATUSES),
  output: z.string().nullable(),
  latencyMs: z.number().int().nullable(),
  tokens: z.number().int(),
  estCostUsd: z.number(),
  checkResults: z.array(checkResultSchema),
  judgeScore: z.number().nullable(),
  judgeReason: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: isoDate,
});
export type TestResultResponse = z.infer<typeof testResultSchema>;

export const runDiffSchema = z.object({
  base: runSchema,
  head: runSchema,
  regressions: z.number().int(),
  fixes: z.number().int(),
  cases: z.array(
    z.object({
      key: z.string(),
      caseName: z.string(),
      base: z.enum(RESULT_STATUSES).nullable(),
      head: z.enum(RESULT_STATUSES).nullable(),
      change: z.enum(['PASS_TO_FAIL', 'FAIL_TO_PASS', 'UNCHANGED', 'ADDED', 'REMOVED']),
    }),
  ),
});
export type RunDiffResponse = z.infer<typeof runDiffSchema>;

export const runCreatedSchema = z.object({ runId: z.string(), status: z.enum(RUN_STATUSES) });
export type RunCreatedResponse = z.infer<typeof runCreatedSchema>;

export const pingResultSchema = z.object({
  ok: z.boolean(),
  latencyMs: z.number().int().nullable(),
  /** First characters of the answer the target gave. */
  outputPreview: z.string().nullable(),
  error: z.string().nullable(),
});
export type PingResultResponse = z.infer<typeof pingResultSchema>;

// ─── Red-team ───────────────────────────────────────────────────────────────

export const attackSchema = z.object({
  id: z.string(),
  category: z.enum(ATTACK_CATEGORIES),
  name: z.string(),
  prompt: z.string(),
  severity: z.enum(SEVERITIES),
});
export type AttackResponse = z.infer<typeof attackSchema>;

export const redteamFindingSchema = z.object({
  id: z.string(),
  redteamRunId: z.string(),
  attackId: z.string(),
  attackName: z.string(),
  category: z.enum(ATTACK_CATEGORIES),
  prompt: z.string(),
  severity: z.enum(SEVERITIES),
  vulnerable: z.boolean(),
  output: z.string().nullable(),
  evidence: z.string().nullable(),
  fixTip: z.string(),
  createdAt: isoDate,
});
export type RedteamFindingResponse = z.infer<typeof redteamFindingSchema>;

export const redteamRunSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  targetId: z.string().nullable(),
  targetName: z.string().nullable(),
  status: z.enum(REDTEAM_STATUSES),
  total: z.number().int(),
  vulnerable: z.number().int(),
  riskScore: z.number().int().nullable(),
  riskLevel: z.enum(SEVERITIES).nullable(),
  startedAt: isoDate.nullable(),
  finishedAt: isoDate.nullable(),
  error: z.string().nullable(),
  createdAt: isoDate,
});
export type RedteamRunResponse = z.infer<typeof redteamRunSchema>;

export const redteamReportSchema = redteamRunSchema.extend({
  categories: z.array(
    z.object({
      category: z.enum(ATTACK_CATEGORIES),
      total: z.number().int(),
      vulnerable: z.number().int(),
      score: z.number().int(),
    }),
  ),
  findings: z.array(redteamFindingSchema),
});
export type RedteamReportResponse = z.infer<typeof redteamReportSchema>;

export const redteamCreatedSchema = z.object({ redteamRunId: z.string(), status: z.enum(REDTEAM_STATUSES) });
export type RedteamCreatedResponse = z.infer<typeof redteamCreatedSchema>;

import { z } from 'zod';
import { TRACE_STATUSES } from '../enums';

export const TRACE_BATCH_MAX = 100;
export const TRACE_TEXT_MAX = 50_000;

export const traceInputSchema = z.object({
  externalId: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(120),
  input: z.string().max(TRACE_TEXT_MAX).optional(),
  output: z.string().max(TRACE_TEXT_MAX).optional(),
  model: z.string().trim().max(100).optional(),
  latencyMs: z.number().int().min(0).max(3_600_000),
  inputTokens: z.number().int().min(0).max(10_000_000).optional(),
  outputTokens: z.number().int().min(0).max(10_000_000).optional(),
  status: z.enum(TRACE_STATUSES).default('OK'),
  error: z.string().max(1000).optional(),
  metadata: z
    .record(z.string().max(100), z.union([z.string().max(1000), z.number(), z.boolean(), z.null()]))
    .refine((metadata) => Object.keys(metadata).length <= 50, 'At most 50 metadata keys')
    .optional(),
  startedAt: z.iso.datetime({ offset: true }).optional(),
});
export type TraceInput = z.input<typeof traceInputSchema>;
export type ParsedTraceInput = z.output<typeof traceInputSchema>;

export const traceBatchSchema = z.object({
  traces: z.array(traceInputSchema).min(1).max(TRACE_BATCH_MAX),
});

/** `POST /v1/traces` accepts one trace or `{ traces: [...] }` (≤ 100). */
export const ingestTracesSchema = z.union([traceBatchSchema, traceInputSchema]);
export type IngestTracesInput = z.input<typeof ingestTracesSchema>;

export function normalizeTraceIngest(input: z.output<typeof ingestTracesSchema>): ParsedTraceInput[] {
  return 'traces' in input ? input.traces : [input];
}

export const USAGE_RANGES = ['24h', '7d', '30d'] as const;
export type UsageRange = (typeof USAGE_RANGES)[number];
export const usageQuerySchema = z.object({ range: z.enum(USAGE_RANGES).default('24h') });

export const traceFilterSchema = z.object({
  status: z.enum(TRACE_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
});

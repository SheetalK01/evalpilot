import {
  ingestTracesSchema,
  paginatedSchema,
  paginationQuerySchema,
  traceFilterSchema,
  traceIngestResultSchema,
  traceListItemSchema,
  traceSchema,
  usageQuerySchema,
  usageSchema,
} from '@evalpilot/shared';
import type { ApiBody } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class TraceQueryDto extends createZodDto(paginationQuerySchema.extend(traceFilterSchema.shape)) {}
export class UsageQueryDto extends createZodDto(usageQuerySchema) {}
export class TraceDto extends createZodDto(traceSchema) {}
export class TracePageDto extends createZodDto(paginatedSchema(traceListItemSchema)) {}
export class UsageDto extends createZodDto(usageSchema) {}
export class TraceIngestResultDto extends createZodDto(traceIngestResultSchema) {}

/** One trace, or `{ traces: [...] }` with up to 100. A union, so documented with a JSON Schema. */
export const ingestTracesBody = {
  schema: z.toJSONSchema(ingestTracesSchema, { io: 'input', unrepresentable: 'any' }),
} as Parameters<typeof ApiBody>[0];

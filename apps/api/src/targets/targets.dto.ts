import type { ApiBody } from '@nestjs/swagger';
import { createTargetSchema, targetSchema, updateTargetSchema } from '@evalpilot/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// A discriminated union (HTTP | SHOPBOT) cannot be a DTO class, so the create body is validated
// with a schema-specific pipe and documented with a generated JSON Schema.
export const createTargetBody = {
  schema: z.toJSONSchema(createTargetSchema, { io: 'input', unrepresentable: 'any' }),
} as Parameters<typeof ApiBody>[0];

export class UpdateTargetDto extends createZodDto(updateTargetSchema) {}
export class TargetDto extends createZodDto(targetSchema) {}

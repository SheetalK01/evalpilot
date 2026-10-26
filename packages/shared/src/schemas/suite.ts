import { z } from 'zod';
import { idSchema, tagsSchema } from './common';
import { checksSchema } from './checks';

export const createSuiteSchema = z.object({
  name: z.string().trim().min(1, 'Name the suite').max(120),
  description: z.string().trim().max(1000).optional(),
  targetId: idSchema.optional(),
  passThreshold: z.number().min(0).max(1).default(0.9),
});
export type CreateSuiteInput = z.infer<typeof createSuiteSchema>;

export const updateSuiteSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  targetId: idSchema.nullable().optional(),
  passThreshold: z.number().min(0).max(1).optional(),
});
export type UpdateSuiteInput = z.infer<typeof updateSuiteSchema>;

export const TEST_CASE_INPUT_MAX = 20_000;

export const createTestCaseSchema = z.object({
  name: z.string().trim().min(1, 'Name the test case').max(120),
  input: z.string().min(1, 'Enter the input to send').max(TEST_CASE_INPUT_MAX),
  checks: checksSchema,
  tags: tagsSchema,
});
export type CreateTestCaseInput = z.infer<typeof createTestCaseSchema>;

export const updateTestCaseSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  input: z.string().min(1).max(TEST_CASE_INPUT_MAX).optional(),
  checks: checksSchema.optional(),
  tags: tagsSchema.optional(),
});
export type UpdateTestCaseInput = z.infer<typeof updateTestCaseSchema>;

export const reorderCasesSchema = z.object({
  ids: z
    .array(idSchema)
    .min(1)
    .max(1000)
    .refine((ids) => new Set(ids).size === ids.length, 'Ids must be unique'),
});
export type ReorderCasesInput = z.infer<typeof reorderCasesSchema>;

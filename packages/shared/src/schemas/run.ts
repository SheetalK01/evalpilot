import { z } from 'zod';
import { RUN_TRIGGERS } from '../enums';

export const commitShaSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{7,40}$/i, 'Use a 7–40 character git SHA')
  .transform((sha) => sha.toLowerCase());

export const createRunSchema = z.object({
  trigger: z.enum(RUN_TRIGGERS).optional(),
  commitSha: commitShaSchema.optional(),
});
export type CreateRunInput = z.infer<typeof createRunSchema>;

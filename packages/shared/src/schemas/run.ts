import { z } from 'zod';
import { ATTACK_CATEGORIES, RUN_TRIGGERS } from '../enums';

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

export const startRedteamSchema = z.object({
  /** Only run attacks from these categories; all categories when omitted. */
  categories: z.array(z.enum(ATTACK_CATEGORIES)).min(1).optional(),
});
export type StartRedteamInput = z.infer<typeof startRedteamSchema>;

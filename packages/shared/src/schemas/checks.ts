import { z } from 'zod';
import { AI_MODES } from '../enums';

/** Upper bounds that keep regex evaluation fast (see `checks/regex.ts`). */
export const REGEX_MAX_PATTERN_LENGTH = 500;

export const containsCheckSchema = z.object({
  type: z.literal('contains'),
  value: z.string().min(1).max(1000),
  caseSensitive: z.boolean().optional(),
});

export const notContainsCheckSchema = z.object({
  type: z.literal('not_contains'),
  value: z.string().min(1).max(1000),
  caseSensitive: z.boolean().optional(),
});

export const equalsCheckSchema = z.object({
  type: z.literal('equals'),
  value: z.string().max(20_000),
});

export const regexCheckSchema = z.object({
  type: z.literal('regex'),
  pattern: z.string().min(1).max(REGEX_MAX_PATTERN_LENGTH),
  // `g` and `y` make RegExp stateful, so they are not allowed.
  flags: z
    .string()
    .regex(/^[imsu]*$/, 'Allowed flags: i, m, s, u')
    .optional(),
});

export const jsonSchemaCheckSchema = z.object({
  type: z.literal('json_schema'),
  schema: z.record(z.string(), z.unknown()),
});

export const maxLengthCheckSchema = z.object({
  type: z.literal('max_length'),
  chars: z.number().int().min(1).max(100_000),
});

export const latencyCheckSchema = z.object({
  type: z.literal('latency'),
  maxMs: z.number().int().min(1).max(600_000),
});

export const refusalCheckSchema = z.object({
  type: z.literal('refusal'),
  expected: z.boolean(),
});

export const llmJudgeCheckSchema = z.object({
  type: z.literal('llm_judge'),
  criteria: z.string().min(3).max(2000),
  threshold: z.number().int().min(1).max(10),
});

export const checkSchema = z.discriminatedUnion('type', [
  containsCheckSchema,
  notContainsCheckSchema,
  equalsCheckSchema,
  regexCheckSchema,
  jsonSchemaCheckSchema,
  maxLengthCheckSchema,
  latencyCheckSchema,
  refusalCheckSchema,
  llmJudgeCheckSchema,
]);

export const checksSchema = z.array(checkSchema).min(1, 'Add at least one check').max(20);

export type Check = z.infer<typeof checkSchema>;
export type CheckType = Check['type'];
export type LlmJudgeCheck = z.infer<typeof llmJudgeCheckSchema>;
/** Every check that can be evaluated without calling a model. */
export type RuleCheck = Exclude<Check, LlmJudgeCheck>;

export const CHECK_TYPES = [
  'contains',
  'not_contains',
  'equals',
  'regex',
  'json_schema',
  'max_length',
  'latency',
  'refusal',
  'llm_judge',
] as const satisfies readonly CheckType[];

// Compile-time guard: fails if a check type is added to the union but not to CHECK_TYPES.
type AssertTrue<T extends true> = T;
type _AllCheckTypesListed = AssertTrue<
  [Exclude<CheckType, (typeof CHECK_TYPES)[number]>] extends [never] ? true : false
>;

export const checkResultSchema = z.object({
  type: z.enum(CHECK_TYPES),
  passed: z.boolean(),
  message: z.string(),
  /** Judge score (1–10) for `llm_judge`. */
  score: z.number().optional(),
  /** Which AI mode produced the verdict, for model-backed checks. */
  mode: z.enum(AI_MODES).optional(),
});

export type CheckResult = z.infer<typeof checkResultSchema>;

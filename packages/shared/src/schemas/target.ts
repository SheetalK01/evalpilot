import { z } from 'zod';
import { HTTP_METHODS } from '../enums';

export const TARGET_TIMEOUT_MIN_MS = 1000;
export const TARGET_TIMEOUT_MAX_MS = 60_000;
export const TARGET_TIMEOUT_DEFAULT_MS = 15_000;
export const INPUT_PLACEHOLDER = '{{input}}';

const headerNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/, 'Invalid header name');

export const headersSchema = z
  .record(headerNameSchema, z.string().max(2000))
  .refine((headers) => Object.keys(headers).length <= 20, 'At most 20 headers');

const timeoutSchema = z
  .number()
  .int()
  .min(TARGET_TIMEOUT_MIN_MS)
  .max(TARGET_TIMEOUT_MAX_MS)
  .default(TARGET_TIMEOUT_DEFAULT_MS);

const nameSchema = z.string().trim().min(1, 'Name the target').max(80);

const httpUrlSchema = z
  .url({ protocol: /^https?$/, message: 'Use an http(s) URL' })
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return url.username === '' && url.password === '';
  }, 'Put credentials in headers, not in the URL');

const httpTargetFields = {
  name: nameSchema,
  url: httpUrlSchema,
  method: z.enum(HTTP_METHODS).default('POST'),
  headers: headersSchema.default({}),
  bodyTemplate: z.string().max(20_000).optional(),
  responsePath: z.string().trim().min(1).max(255).default('$'),
  timeoutMs: timeoutSchema,
};

function requiresBodyPlaceholder(target: { method: string; bodyTemplate?: string | undefined; url: string }) {
  if (target.method === 'GET')
    return target.url.includes(INPUT_PLACEHOLDER) || target.url.includes('%7B%7Binput%7D%7D');
  return target.bodyTemplate?.includes(INPUT_PLACEHOLDER) ?? false;
}

const PLACEHOLDER_MESSAGE = `Include ${INPUT_PLACEHOLDER} in the body template (or in the URL for GET)`;

export const httpTargetSchema = z
  .object({ type: z.literal('HTTP'), ...httpTargetFields })
  .refine(requiresBodyPlaceholder, { message: PLACEHOLDER_MESSAGE, path: ['bodyTemplate'] });

export const shopbotTargetSchema = z.object({
  type: z.literal('SHOPBOT'),
  name: nameSchema,
  timeoutMs: timeoutSchema,
});

export const createTargetSchema = z.discriminatedUnion('type', [httpTargetSchema, shopbotTargetSchema]);
export type CreateTargetInput = z.infer<typeof createTargetSchema>;

/** The type of a target cannot change; every other field is optional. */
export const updateTargetSchema = z.object({
  name: nameSchema.optional(),
  url: httpUrlSchema.optional(),
  method: z.enum(HTTP_METHODS).optional(),
  headers: headersSchema.optional(),
  bodyTemplate: z.string().max(20_000).optional(),
  responsePath: z.string().trim().min(1).max(255).optional(),
  timeoutMs: z.number().int().min(TARGET_TIMEOUT_MIN_MS).max(TARGET_TIMEOUT_MAX_MS).optional(),
});
export type UpdateTargetInput = z.infer<typeof updateTargetSchema>;

/** Header values are never returned in full; this replaces them in API responses. */
export function maskHeaderValue(value: string): string {
  if (value.length <= 4) return '••••';
  return `${'•'.repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
}

export function maskHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, maskHeaderValue(value)]));
}

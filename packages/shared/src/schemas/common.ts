import { z } from 'zod';

/** Prisma cuid ids. Kept loose (length only) so ids from other generators still validate. */
export const idSchema = z.string().trim().min(1).max(40);

export const PAGE_LIMIT_DEFAULT = 20;
export const PAGE_LIMIT_MAX = 100;

export const paginationQuerySchema = z.object({
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  /** Pass as `cursor` to get the next page; `null` on the last page. */
  nextCursor: string | null;
}

/** Shape of every error response from the API. */
export interface ApiErrorBody {
  statusCode: number;
  message: string;
  errors?: { path: string; message: string }[];
  path: string;
  requestId: string;
  timestamp: string;
}

export const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(30)
      .regex(/^[\w-]+$/, 'Tags may contain letters, numbers, - and _'),
  )
  .max(10)
  .default([]);

import type { Paginated, PaginationQuery } from '@evalpilot/shared';

export interface PageArgs {
  take: number;
  skip?: number;
  cursor?: { id: string };
}

/**
 * Cursor pagination over a Prisma query ordered by (createdAt desc, id desc).
 * Fetches one extra row to know whether another page exists.
 */
export async function paginate<T extends { id: string }>(
  query: PaginationQuery,
  fetch: (args: PageArgs) => Promise<T[]>,
): Promise<Paginated<T>> {
  const rows = await fetch({
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

export const NEWEST_FIRST = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

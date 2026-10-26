import { describe, expect, it } from 'vitest';
import { healthSchema, paginatedSchema, projectSchema, targetSchema } from '../src';

const now = '2026-10-26T10:00:00.000Z';

describe('response schemas', () => {
  it('wraps any item schema in a paginated envelope', () => {
    const page = paginatedSchema(projectSchema);
    const project = {
      id: 'p1',
      name: 'ShopSphere',
      description: null,
      suiteCount: 1,
      targetCount: 1,
      createdAt: now,
      updatedAt: now,
    };
    expect(page.parse({ items: [project], nextCursor: null })).toEqual({
      items: [project],
      nextCursor: null,
    });
    expect(
      page.safeParse({ items: [{ ...project, createdAt: 'yesterday' }], nextCursor: null }).success,
    ).toBe(false);
  });

  it('describes masked targets and health', () => {
    expect(
      targetSchema.safeParse({
        id: 't1',
        projectId: 'p1',
        name: 'ShopBot',
        type: 'SHOPBOT',
        url: null,
        method: 'POST',
        headers: {},
        bodyTemplate: null,
        responsePath: null,
        timeoutMs: 15000,
        createdAt: now,
        updatedAt: now,
      }).success,
    ).toBe(true);
    expect(
      healthSchema.safeParse({
        status: 'ok',
        checks: { api: 'up', db: 'up', redis: 'down', worker: 'up' },
        version: '1',
        time: now,
      }).success,
    ).toBe(true);
  });
});

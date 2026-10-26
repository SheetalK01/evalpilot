import { paginate } from './pagination';

const rows = Array.from({ length: 5 }, (_, i) => ({ id: `id-${i}` }));

describe('paginate', () => {
  it('fetches one extra row and returns a cursor when more exist', async () => {
    const fetch = jest.fn((args: { take: number }) => Promise.resolve(rows.slice(0, args.take)));
    const page = await paginate({ limit: 2 }, fetch);
    expect(fetch).toHaveBeenCalledWith({ take: 3 });
    expect(page).toEqual({ items: [{ id: 'id-0' }, { id: 'id-1' }], nextCursor: 'id-1' });
  });

  it('skips the cursor row on the next page', async () => {
    const fetch = jest.fn(() => Promise.resolve(rows.slice(2, 5)));
    const page = await paginate({ limit: 5, cursor: 'id-1' }, fetch);
    expect(fetch).toHaveBeenCalledWith({ take: 6, cursor: { id: 'id-1' }, skip: 1 });
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(3);
  });
});

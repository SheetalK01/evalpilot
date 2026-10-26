import { lastDays } from './dashboard.service';

describe('lastDays', () => {
  it('lists UTC dates, oldest first, ending today', () => {
    expect(lastDays(new Date('2026-03-02T23:59:00.000Z'), 4)).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
  });
});

import { parseStoredChecks, parseStoredTags } from './test-case.mapper';

describe('stored JSON parsing', () => {
  it('returns valid checks and drops unreadable data', () => {
    expect(parseStoredChecks([{ type: 'contains', value: 'a' }])).toEqual([{ type: 'contains', value: 'a' }]);
    expect(parseStoredChecks([{ type: 'nope' }])).toEqual([]);
    expect(parseStoredChecks('not json')).toEqual([]);
  });

  it('keeps only string tags', () => {
    expect(parseStoredTags(['smoke', 3, null, 'pii'])).toEqual(['smoke', 'pii']);
    expect(parseStoredTags({ not: 'an array' })).toEqual([]);
  });
});

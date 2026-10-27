import { describe, expect, it } from 'vitest';
import { CSV_MAX_ROWS, parseCsv, parseTestCasesCsv, testCasesToCsv, toCsv } from '../src';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas, newlines, CRLF and BOM', () => {
    const text = '\uFEFFname,input\r\n"Refund, please","She said ""hi""\nthen left"\r\nplain,value\n';
    expect(parseCsv(text)).toEqual([
      ['name', 'input'],
      ['Refund, please', 'She said "hi"\nthen left'],
      ['plain', 'value'],
    ]);
  });

  it('keeps empty fields and skips blank lines', () => {
    expect(parseCsv('a,,c\n\n1,2,\n')).toEqual([
      ['a', '', 'c'],
      ['1', '2', ''],
    ]);
  });

  it('handles a last line without a newline and lone CR line endings', () => {
    expect(parseCsv('a,b\rc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('throws on an unclosed quote', () => {
    expect(() => parseCsv('"oops')).toThrow('Unclosed quote');
  });
});

describe('toCsv', () => {
  it('quotes when needed and guards against formula injection', () => {
    expect(toCsv([['a,b', 'say "x"', '=HYPERLINK("evil")', 'ok', ' padded']])).toBe(
      '"a,b","say ""x""","\'=HYPERLINK(""evil"")",ok," padded"\r\n',
    );
  });
});

describe('test case CSV round trip', () => {
  const cases = [
    {
      name: 'Refund window',
      input: 'How long do I have to return?',
      checks: [{ type: 'contains', value: '30 days' }],
      tags: ['smoke', 'refunds'],
    },
    {
      name: '=Formula name',
      input: 'Multi\nline, "quoted"',
      checks: [{ type: 'max_length', chars: 300 }],
      tags: [],
    },
  ];

  it('exports and re-imports the same cases', () => {
    const result = parseTestCasesCsv(testCasesToCsv(cases));
    expect(result.errors).toEqual([]);
    expect(result.cases).toEqual(cases);
  });
});

describe('parseTestCasesCsv', () => {
  it('reports invalid rows with their line numbers and imports the rest', () => {
    const csv = [
      'name,input,checks,tags',
      'Good,Hello,"[{""type"":""contains"",""value"":""hi""}]",smoke',
      'Bad JSON,Hello,{not json},',
      'No checks,Hello,[],',
      ',Hello,"[{""type"":""equals"",""value"":""x""}]",',
    ].join('\n');
    const result = parseTestCasesCsv(csv);
    expect(result.cases).toHaveLength(1);
    expect(result.cases[0]?.tags).toEqual(['smoke']);
    expect(result.errors.map((e) => e.row)).toEqual([3, 4, 5]);
    expect(result.errors[0]?.message).toBe('checks: not valid JSON');
    expect(result.errors[1]?.message).toContain('checks');
    expect(result.errors[2]?.message).toContain('name');
  });

  it('accepts columns in any order and without tags', () => {
    const result = parseTestCasesCsv(
      'INPUT,Checks,Name\nHi,"[{""type"":""latency"",""maxMs"":500}]",Speed\n',
    );
    expect(result.cases).toEqual([
      { name: 'Speed', input: 'Hi', checks: [{ type: 'latency', maxMs: 500 }], tags: [] },
    ]);
  });

  it('defaults a missing checks cell to an empty list (which is rejected)', () => {
    expect(parseTestCasesCsv('name,input,checks\nA,B,\n').errors[0]?.message).toContain(
      'Add at least one check',
    );
  });

  it.each([
    ['', 'The file is empty'],
    ['name,checks\nA,[]', 'Missing column(s): input'],
    ['"unclosed', 'Unclosed quote in CSV'],
  ])('rejects the whole file: %j', (csv, message) => {
    expect(parseTestCasesCsv(csv)).toEqual({ cases: [], errors: [{ row: 1, message }] });
  });

  it('limits the number of rows', () => {
    const rows = Array.from({ length: CSV_MAX_ROWS + 1 }, (_, i) => `c${i},in,[]`);
    expect(parseTestCasesCsv(['name,input,checks', ...rows].join('\n')).errors[0]?.message).toContain(
      'At most',
    );
  });
});

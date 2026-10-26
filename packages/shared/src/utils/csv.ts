import type { z } from 'zod';
import { createTestCaseSchema, type CreateTestCaseInput } from '../schemas/suite';

export const CSV_MAX_ROWS = 1000;
export const CSV_COLUMNS = ['name', 'input', 'checks', 'tags'] as const;
const TAG_SEPARATOR = '|';

/** RFC 4180 parser: quoted fields, escaped quotes (""), commas and newlines inside quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < source.length; i++) {
    const char = source.charAt(i);
    if (inQuotes) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (inQuotes) throw new Error('Unclosed quote in CSV');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Cells starting with these could run as formulas when opened in a spreadsheet. */
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\n\r]|^\s|\s$/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function unescapeFormulaGuard(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}

export interface CsvTestCase {
  name: string;
  input: string;
  checks: unknown;
  tags: readonly string[];
}

export function testCasesToCsv(cases: readonly CsvTestCase[]): string {
  return toCsv([
    [...CSV_COLUMNS],
    ...cases.map((c) => [c.name, c.input, JSON.stringify(c.checks), c.tags.join(TAG_SEPARATOR)]),
  ]);
}

export interface CsvRowError {
  /** 1-based line number in the file (the header is row 1). */
  row: number;
  message: string;
}

export interface CsvImportResult {
  cases: CreateTestCaseInput[];
  errors: CsvRowError[];
}

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || 'row'}: ${issue.message}`).join('; ');
}

/** Parses an uploaded CSV into validated test cases. Rows with problems are reported, not imported. */
export function parseTestCasesCsv(text: string): CsvImportResult {
  let rows: string[][];
  try {
    rows = parseCsv(text);
  } catch (error) {
    return {
      cases: [],
      errors: [{ row: 1, message: error instanceof Error ? error.message : 'Invalid CSV' }],
    };
  }
  const [header, ...body] = rows;
  if (!header) return { cases: [], errors: [{ row: 1, message: 'The file is empty' }] };
  const columns = header.map((name) => name.trim().toLowerCase());
  const missing = ['name', 'input', 'checks'].filter((name) => !columns.includes(name));
  if (missing.length > 0)
    return { cases: [], errors: [{ row: 1, message: `Missing column(s): ${missing.join(', ')}` }] };
  if (body.length > CSV_MAX_ROWS)
    return { cases: [], errors: [{ row: 1, message: `At most ${CSV_MAX_ROWS} rows per import` }] };

  const cell = (row: string[], name: string) => unescapeFormulaGuard(row[columns.indexOf(name)] ?? '');
  const cases: CreateTestCaseInput[] = [];
  const errors: CsvRowError[] = [];
  body.forEach((row, index) => {
    const line = index + 2;
    let checks: unknown;
    try {
      checks = JSON.parse(cell(row, 'checks') || '[]');
    } catch {
      errors.push({ row: line, message: 'checks: not valid JSON' });
      return;
    }
    const tagsCell = columns.includes('tags') ? cell(row, 'tags') : '';
    const parsed = createTestCaseSchema.safeParse({
      name: cell(row, 'name'),
      input: cell(row, 'input'),
      checks,
      tags: tagsCell
        .split(TAG_SEPARATOR)
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    if (parsed.success) cases.push(parsed.data);
    else errors.push({ row: line, message: formatZodError(parsed.error) });
  });
  return { cases, errors };
}

/**
 * Minimal JSON path reader for picking the answer out of a target's response.
 * Supports `$`, `$.a.b`, `a.b`, `a[0].b`, `$['key with space']` and `a.0.b`.
 */
export function parseJsonPath(path: string): (string | number)[] {
  const trimmed = path.trim();
  if (trimmed === '' || trimmed === '$') return [];
  const body = trimmed.startsWith('$') ? trimmed.slice(1) : `.${trimmed}`;
  const segments: (string | number)[] = [];
  const pattern = /\.([^.[\]]+)|\[(\d+)\]|\[\s*'([^']*)'\s*\]|\[\s*"([^"]*)"\s*\]/gy;
  let match: RegExpExecArray | null;
  let consumed = 0;
  while ((match = pattern.exec(body)) !== null) {
    consumed = pattern.lastIndex;
    const [, dotted, index, single, double] = match;
    if (index !== undefined) segments.push(Number(index));
    else segments.push(dotted ?? single ?? double ?? '');
  }
  if (consumed !== body.length) throw new Error(`Invalid JSON path: ${path}`);
  return segments;
}

export function readJsonPath(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const segment of parseJsonPath(path)) {
    if (current === null || typeof current !== 'object') return undefined;
    if (Array.isArray(current)) {
      const index = typeof segment === 'number' ? segment : Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
    } else {
      current = (current as Record<string, unknown>)[String(segment)];
    }
  }
  return current;
}

/** Turns whatever the path pointed at into the text that checks run against. */
export function answerToText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

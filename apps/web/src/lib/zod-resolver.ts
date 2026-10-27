import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * react-hook-form resolver for zod 4 schemas (instead of @hookform/resolvers, whose many optional
 * peer dependencies clash in this monorepo). Field errors are keyed by their dotted path.
 */
export function zodResolver<S extends z.ZodType<FieldValues, FieldValues>>(
  schema: S,
): Resolver<z.input<S>, unknown, z.output<S>> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root';
      errors[path] ??= { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: toNested(errors) as FieldErrors<z.input<S>> };
  };
}

/** { "checks.0.value": e } → { checks: [{ value: e }] }, the shape react-hook-form expects. */
export function toNested(flat: Record<string, unknown>): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.');
    let node: Record<string, unknown> = root;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        node[part] = value;
        return;
      }
      const next = parts[index + 1] ?? '';
      node[part] ??= /^\d+$/.test(next) ? [] : {};
      node = node[part] as Record<string, unknown>;
    });
  }
  return root;
}

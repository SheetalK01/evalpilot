import { maskHeaderValue } from '@evalpilot/shared';

/**
 * The UI sends back the masked header values it received. A value that still equals the mask of
 * the stored value means "unchanged", so the real secret is kept.
 */
export function mergeMaskedHeaders(
  incoming: Record<string, string>,
  existing: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(incoming).map(([name, value]) => {
      const current = existing[name];
      return [name, current !== undefined && value === maskHeaderValue(current) ? current : value];
    }),
  );
}

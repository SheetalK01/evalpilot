import { REGEX_MAX_PATTERN_LENGTH } from '../schemas/checks';

/** Only the first part of very long outputs is searched, to bound evaluation time. */
export const REGEX_MAX_INPUT_LENGTH = 20_000;

/**
 * Patterns like `(a+)+`, `(a*)*` or `(\w+\s?)*` backtrack exponentially. JavaScript has no
 * regex timeout, so we reject a quantified group that itself contains a quantifier.
 */
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*(?:[+*]|\{\d+,\d*\})(?:[^()\\]|\\.)*\)(?:[+*]|\{\d+,\d*\})/;

/** Back-references inside a quantified group are another common catastrophic shape. */
const QUANTIFIED_BACKREFERENCE = /\\\d+(?:[+*]|\{\d+,\d*\})/;

export type SafeRegexResult = { ok: true; regex: RegExp } | { ok: false; error: string };

export function compileSafeRegex(pattern: string, flags = ''): SafeRegexResult {
  if (pattern.length > REGEX_MAX_PATTERN_LENGTH) {
    return { ok: false, error: `Pattern is longer than ${REGEX_MAX_PATTERN_LENGTH} characters` };
  }
  if (/[gy]/.test(flags)) {
    return { ok: false, error: 'Flags g and y are not allowed' };
  }
  if (NESTED_QUANTIFIER.test(pattern) || QUANTIFIED_BACKREFERENCE.test(pattern)) {
    return { ok: false, error: 'Pattern has nested quantifiers that could hang (e.g. "(a+)+")' };
  }
  try {
    return { ok: true, regex: new RegExp(pattern, flags) };
  } catch (error) {
    return { ok: false, error: `Invalid pattern: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export function safeRegexTest(
  pattern: string,
  flags: string | undefined,
  input: string,
): SafeRegexResult & { matched?: boolean } {
  const compiled = compileSafeRegex(pattern, flags);
  if (!compiled.ok) return compiled;
  return { ...compiled, matched: compiled.regex.test(input.slice(0, REGEX_MAX_INPUT_LENGTH)) };
}

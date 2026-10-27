import { Ajv, type ValidateFunction } from 'ajv';

// Created on first use, so browser bundles that import @evalpilot/shared do not pay for Ajv.
let ajv: Ajv | null = null;
const cache = new Map<string, ValidateFunction>();
const CACHE_LIMIT = 200;

function compile(schema: Record<string, unknown>): ValidateFunction {
  const key = JSON.stringify(schema);
  const cached = cache.get(key);
  if (cached) return cached;
  ajv ??= new Ajv({ allErrors: false, strict: false });
  const validate = ajv.compile(schema);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, validate);
  return validate;
}

export function isValidJsonSchema(schema: Record<string, unknown>): boolean {
  try {
    compile(schema);
    return true;
  } catch {
    return false;
  }
}

export type JsonSchemaResult = { valid: true } | { valid: false; error: string };

export function validateJsonOutput(output: string, schema: Record<string, unknown>): JsonSchemaResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(output));
  } catch {
    return { valid: false, error: 'Output is not valid JSON' };
  }
  let validate: ValidateFunction;
  try {
    validate = compile(schema);
  } catch (error) {
    return {
      valid: false,
      error: `Invalid JSON schema: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (validate(parsed)) return { valid: true };
  const first = validate.errors?.[0];
  const where = first && first.instancePath !== '' ? first.instancePath : 'value';
  return { valid: false, error: `Schema mismatch at ${where}: ${first?.message ?? 'invalid'}` };
}

/** Models often wrap JSON in ```json fences; accept that. */
function stripCodeFence(output: string): string {
  const match = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(output);
  return match?.[1] ?? output;
}

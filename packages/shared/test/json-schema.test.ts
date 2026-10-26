import { describe, expect, it } from 'vitest';
import { isValidJsonSchema, validateJsonOutput } from '../src';

const orderSchema = {
  type: 'object',
  required: ['orderId', 'status'],
  properties: { orderId: { type: 'string' }, status: { enum: ['SHIPPED', 'PENDING'] } },
};

describe('validateJsonOutput', () => {
  it('accepts matching JSON', () => {
    expect(validateJsonOutput('{"orderId":"10423","status":"SHIPPED"}', orderSchema)).toEqual({
      valid: true,
    });
  });

  it('points at the failing property', () => {
    const result = validateJsonOutput('{"orderId":"1","status":"LOST"}', orderSchema);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('/status');
  });

  it('rejects non-JSON output', () => {
    expect(validateJsonOutput('Your order shipped!', orderSchema)).toEqual({
      valid: false,
      error: 'Output is not valid JSON',
    });
  });

  it('reports an invalid schema instead of throwing', () => {
    const result = validateJsonOutput('{}', { type: 'not-a-type' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/^Invalid JSON schema/);
  });

  it('reuses compiled schemas', () => {
    for (let i = 0; i < 3; i++)
      expect(validateJsonOutput('{"orderId":"1","status":"PENDING"}', orderSchema).valid).toBe(true);
  });

  it('keeps working after the compile cache fills up', () => {
    for (let i = 0; i < 210; i++) {
      expect(
        validateJsonOutput(`{"n":${i}}`, { type: 'object', properties: { n: { const: i } } }).valid,
      ).toBe(true);
    }
  });
});

describe('isValidJsonSchema', () => {
  it('detects valid and invalid schemas', () => {
    expect(isValidJsonSchema(orderSchema)).toBe(true);
    expect(isValidJsonSchema({ type: 12 })).toBe(false);
  });
});

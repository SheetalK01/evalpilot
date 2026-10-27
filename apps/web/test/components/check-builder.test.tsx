import type { Check } from '@evalpilot/shared';
import { checksSchema } from '@evalpilot/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  CheckBuilder,
  type CheckDraft,
  defaultCheck,
  describeCheck,
  fromDraft,
  toDraft,
} from '@/components/suite/check-builder';

const ALL: Check[] = [
  { type: 'contains', value: '30 days', caseSensitive: true },
  { type: 'not_contains', value: '@' },
  { type: 'equals', value: 'yes' },
  { type: 'regex', pattern: '3\\s*-\\s*5', flags: 'i' },
  { type: 'json_schema', schema: { type: 'object', required: ['id'] } },
  { type: 'max_length', chars: 400 },
  { type: 'latency', maxMs: 3000 },
  { type: 'refusal', expected: true },
  { type: 'llm_judge', criteria: 'Polite and accurate', threshold: 7 },
];

describe('check drafts', () => {
  it('round-trips every check type through the editor form', () => {
    const back = ALL.map((check) => fromDraft(toDraft(check)));
    expect(back).toEqual(
      ALL.map((c) => (c.type === 'not_contains' ? { type: 'not_contains', value: '@' } : c)),
    );
    expect(checksSchema.safeParse(back).success).toBe(true);
  });

  it('rejects invalid JSON in a schema check', () => {
    expect(() => fromDraft({ type: 'json_schema', schema: '{oops' })).toThrow(
      'The JSON schema is not valid JSON',
    );
  });

  it('describes checks in one short line', () => {
    expect(ALL.map(describeCheck)).toEqual([
      'contains “30 days”',
      'not “@”',
      'equals “yes”',
      '/3\\s*-\\s*5/i',
      'json schema',
      '≤ 400 chars',
      '≤ 3000 ms',
      'must refuse',
      'judge ≥ 7',
    ]);
  });
});

function Harness({ initial }: { initial: CheckDraft[] }) {
  const [checks, setChecks] = useState(initial);
  return (
    <>
      <CheckBuilder checks={checks} onChange={setChecks} />
      <output data-testid="state">{JSON.stringify(checks)}</output>
    </>
  );
}

describe('CheckBuilder', () => {
  it('adds, retypes, edits and removes checks', () => {
    render(<Harness initial={[defaultCheck()]} />);
    const state = () => JSON.parse(screen.getByTestId('state').textContent) as CheckDraft[];

    fireEvent.change(screen.getByTestId('check-value'), { target: { value: 'refund' } });
    expect(state()[0]).toMatchObject({ type: 'contains', value: 'refund' });

    fireEvent.click(screen.getByTestId('check-add'));
    expect(screen.getAllByTestId('check-row')).toHaveLength(2);

    fireEvent.change(screen.getAllByTestId('check-type-select')[1]!, { target: { value: 'llm_judge' } });
    expect(state()[1]).toMatchObject({ type: 'llm_judge', threshold: '7' });

    fireEvent.click(screen.getAllByTestId('check-remove')[0]!);
    expect(state().map((c) => c.type)).toEqual(['llm_judge']);
  });
});

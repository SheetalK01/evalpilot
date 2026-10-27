'use client';

import { type Check, CHECK_TYPES, type CheckType } from '@evalpilot/shared';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input, Select, Textarea } from '../ui/field';
import { Switch } from '../ui/misc';

export const CHECK_LABELS: Record<CheckType, string> = {
  contains: 'Contains',
  not_contains: 'Does not contain',
  equals: 'Equals',
  regex: 'Matches regex',
  json_schema: 'JSON schema',
  max_length: 'Max length',
  latency: 'Latency',
  refusal: 'Refusal',
  llm_judge: 'AI judge',
};

/** Editable form of a check: every field is a string until saved. */
export type CheckDraft = { type: CheckType } & Record<string, string | boolean>;

const DEFAULTS: Record<CheckType, CheckDraft> = {
  contains: { type: 'contains', value: '', caseSensitive: false },
  not_contains: { type: 'not_contains', value: '', caseSensitive: false },
  equals: { type: 'equals', value: '' },
  regex: { type: 'regex', pattern: '', flags: 'i' },
  json_schema: { type: 'json_schema', schema: '{\n  "type": "object"\n}' },
  max_length: { type: 'max_length', chars: '500' },
  latency: { type: 'latency', maxMs: '3000' },
  refusal: { type: 'refusal', expected: 'true' },
  llm_judge: { type: 'llm_judge', criteria: '', threshold: '7' },
};

export const defaultCheck = (type: CheckType = 'contains'): CheckDraft => ({ ...DEFAULTS[type] });

export function toDraft(check: Check): CheckDraft {
  switch (check.type) {
    case 'contains':
    case 'not_contains':
      return { type: check.type, value: check.value, caseSensitive: check.caseSensitive ?? false };
    case 'equals':
      return { type: 'equals', value: check.value };
    case 'regex':
      return { type: 'regex', pattern: check.pattern, flags: check.flags ?? '' };
    case 'json_schema':
      return { type: 'json_schema', schema: JSON.stringify(check.schema, null, 2) };
    case 'max_length':
      return { type: 'max_length', chars: String(check.chars) };
    case 'latency':
      return { type: 'latency', maxMs: String(check.maxMs) };
    case 'refusal':
      return { type: 'refusal', expected: String(check.expected) };
    case 'llm_judge':
      return { type: 'llm_judge', criteria: check.criteria, threshold: String(check.threshold) };
  }
}

/** Converts drafts to API checks. Throws a readable message for invalid JSON. */
export function fromDraft(draft: CheckDraft): Record<string, unknown> {
  const s = (key: string) => String(draft[key] ?? '');
  switch (draft.type) {
    case 'contains':
    case 'not_contains':
      return { type: draft.type, value: s('value'), ...(draft.caseSensitive ? { caseSensitive: true } : {}) };
    case 'equals':
      return { type: 'equals', value: s('value') };
    case 'regex':
      return { type: 'regex', pattern: s('pattern'), ...(s('flags') ? { flags: s('flags') } : {}) };
    case 'json_schema': {
      try {
        return { type: 'json_schema', schema: JSON.parse(s('schema')) as unknown };
      } catch {
        throw new Error('The JSON schema is not valid JSON');
      }
    }
    case 'max_length':
      return { type: 'max_length', chars: Number(s('chars')) };
    case 'latency':
      return { type: 'latency', maxMs: Number(s('maxMs')) };
    case 'refusal':
      return { type: 'refusal', expected: s('expected') === 'true' };
    case 'llm_judge':
      return { type: 'llm_judge', criteria: s('criteria'), threshold: Number(s('threshold')) };
  }
}

/** One-line summary for the cases table, e.g. `contains "30 days"`. */
export function describeCheck(check: Check): string {
  switch (check.type) {
    case 'contains':
      return `contains “${check.value}”`;
    case 'not_contains':
      return `not “${check.value}”`;
    case 'equals':
      return `equals “${check.value.slice(0, 24)}”`;
    case 'regex':
      return `/${check.pattern.slice(0, 28)}/${check.flags ?? ''}`;
    case 'json_schema':
      return 'json schema';
    case 'max_length':
      return `≤ ${check.chars} chars`;
    case 'latency':
      return `≤ ${check.maxMs} ms`;
    case 'refusal':
      return check.expected ? 'must refuse' : 'must answer';
    case 'llm_judge':
      return `judge ≥ ${check.threshold}`;
  }
}

function Fields({
  draft,
  onChange,
  index,
}: {
  draft: CheckDraft;
  onChange: (draft: CheckDraft) => void;
  index: number;
}) {
  const set = (key: string, value: string | boolean) => onChange({ ...draft, [key]: value });
  const value = (key: string) => String(draft[key] ?? '');
  const id = (key: string) => `check-${index}-${key}`;
  switch (draft.type) {
    case 'contains':
    case 'not_contains':
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Input
            id={id('value')}
            aria-label="Text"
            className="min-w-48 flex-1"
            value={value('value')}
            onChange={(e) => set('value', e.target.value)}
            placeholder="30 days"
            data-testid="check-value"
          />
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <Switch
              checked={Boolean(draft.caseSensitive)}
              onCheckedChange={(checked) => set('caseSensitive', checked)}
              aria-label="Case sensitive"
            />{' '}
            Case sensitive
          </label>
        </div>
      );
    case 'equals':
      return (
        <Textarea
          id={id('value')}
          aria-label="Expected answer"
          rows={2}
          value={value('value')}
          onChange={(e) => set('value', e.target.value)}
          data-testid="check-value"
        />
      );
    case 'regex':
      return (
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <Input
            id={id('pattern')}
            aria-label="Pattern"
            mono
            value={value('pattern')}
            onChange={(e) => set('pattern', e.target.value)}
            placeholder="3\s*[-–]\s*5 days"
            data-testid="check-value"
          />
          <Input
            id={id('flags')}
            aria-label="Flags"
            mono
            value={value('flags')}
            onChange={(e) => set('flags', e.target.value)}
            placeholder="flags"
          />
        </div>
      );
    case 'json_schema':
      return (
        <Textarea
          id={id('schema')}
          aria-label="JSON schema"
          mono
          rows={5}
          value={value('schema')}
          onChange={(e) => set('schema', e.target.value)}
          data-testid="check-value"
        />
      );
    case 'max_length':
      return (
        <Input
          id={id('chars')}
          aria-label="Maximum characters"
          type="number"
          mono
          min={1}
          value={value('chars')}
          onChange={(e) => set('chars', e.target.value)}
          data-testid="check-value"
        />
      );
    case 'latency':
      return (
        <Input
          id={id('maxMs')}
          aria-label="Maximum milliseconds"
          type="number"
          mono
          min={1}
          value={value('maxMs')}
          onChange={(e) => set('maxMs', e.target.value)}
          data-testid="check-value"
        />
      );
    case 'refusal':
      return (
        <Select
          id={id('expected')}
          aria-label="Expected behaviour"
          value={value('expected')}
          onChange={(e) => set('expected', e.target.value)}
          data-testid="check-value"
        >
          <option value="true">The bot must refuse</option>
          <option value="false">The bot must answer</option>
        </Select>
      );
    case 'llm_judge':
      return (
        <div className="grid gap-2 sm:grid-cols-[1fr_96px]">
          <Textarea
            id={id('criteria')}
            aria-label="Criteria"
            rows={2}
            value={value('criteria')}
            onChange={(e) => set('criteria', e.target.value)}
            placeholder="Apologises and offers a replacement or a refund"
            data-testid="check-value"
          />
          <Input
            id={id('threshold')}
            aria-label="Minimum score (1-10)"
            type="number"
            mono
            min={1}
            max={10}
            value={value('threshold')}
            onChange={(e) => set('threshold', e.target.value)}
          />
        </div>
      );
  }
}

/** Add, edit and remove the checks of a test case. All checks must pass for the case to pass. */
export function CheckBuilder({
  checks,
  onChange,
}: {
  checks: CheckDraft[];
  onChange: (checks: CheckDraft[]) => void;
}) {
  return (
    <div className="space-y-2">
      {checks.map((check, index) => (
        <div key={index} className="panel space-y-3 p-3" data-testid="check-row">
          <div className="flex items-center gap-2">
            <span className="num w-5 text-[12px] text-muted">{String(index + 1).padStart(2, '0')}</span>
            <Select
              aria-label="Check type"
              className="max-w-56"
              value={check.type}
              data-testid="check-type-select"
              onChange={(e) =>
                onChange(checks.map((c, i) => (i === index ? defaultCheck(e.target.value as CheckType) : c)))
              }
            >
              {CHECK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CHECK_LABELS[type]}
                </option>
              ))}
            </Select>
            <Button
              size="icon-sm"
              variant="ghost"
              className="ml-auto"
              aria-label="Remove check"
              onClick={() => onChange(checks.filter((_, i) => i !== index))}
              data-testid="check-remove"
            >
              <X />
            </Button>
          </div>
          <Fields
            index={index}
            draft={check}
            onChange={(next) => onChange(checks.map((c, i) => (i === index ? next : c)))}
          />
        </div>
      ))}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange([...checks, defaultCheck()])}
        data-testid="check-add"
      >
        <Plus /> Add check
      </Button>
    </div>
  );
}

'use client';

import { createTestCaseSchema, type TestCaseResponse } from '@evalpilot/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { useSaveCase } from '@/lib/queries';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog';
import { Field, Input, Textarea } from '../ui/field';
import { CheckBuilder, type CheckDraft, defaultCheck, fromDraft, toDraft } from './check-builder';

/** Drawer to add or edit a test case, with the check builder. */
export function CaseDrawer({
  suiteId,
  testCase,
  open,
  onOpenChange,
}: {
  suiteId: string;
  testCase: TestCaseResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveCase(suiteId);
  const [name, setName] = useState(testCase?.name ?? '');
  const [input, setInput] = useState(testCase?.input ?? '');
  const [tags, setTags] = useState(testCase?.tags.join(', ') ?? '');
  const [checks, setChecks] = useState<CheckDraft[]>(
    testCase ? testCase.checks.map(toDraft) : [defaultCheck()],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    let body;
    try {
      body = {
        name,
        input,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        checks: checks.map(fromDraft),
      };
    } catch (error) {
      setErrors({ checks: error instanceof Error ? error.message : 'Invalid check' });
      return;
    }
    const parsed = createTestCaseSchema.safeParse(body);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path[0] === 'checks' ? 'checks' : String(issue.path[0] ?? 'form'),
            issue.path[0] === 'checks'
              ? `Check ${Number(issue.path[1] ?? 0) + 1}: ${issue.message}`
              : issue.message,
          ]),
        ),
      );
      return;
    }
    setErrors({});
    save.mutate(
      { id: testCase?.id, body: parsed.data },
      {
        onSuccess: () => {
          toast.success(testCase ? 'Test case saved' : 'Test case added');
          onOpenChange(false);
        },
        onError: (error) =>
          error instanceof ApiError && error.fieldErrors.length
            ? setErrors({ form: error.fieldErrors.map((e) => `${e.path}: ${e.message}`).join(' · ') })
            : toast.error(error.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        side="right"
        title={testCase ? 'Edit test case' : 'New test case'}
        description="What to send, and what a good answer must look like. Every check must pass."
        data-testid="case-drawer"
      >
        <form
          className="space-y-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Field id="case-name" label="Name" error={errors.name}>
            <Input
              id="case-name"
              autoFocus
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="Refund window is 30 days"
              data-testid="case-name"
              aria-invalid={Boolean(errors.name)}
            />
          </Field>
          <Field
            id="case-input"
            label="Input"
            hint="Sent to the target as the user's message."
            error={errors.input}
          >
            <Textarea
              id="case-input"
              rows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Can I still return a jacket I bought two weeks ago?"
              data-testid="case-input"
              aria-invalid={Boolean(errors.input)}
            />
          </Field>
          <div className="space-y-2">
            <span className="label-mono block">Checks</span>
            <CheckBuilder checks={checks} onChange={setChecks} />
            {errors.checks ? (
              <p role="alert" className="text-[13px] text-fail">
                {errors.checks}
              </p>
            ) : null}
          </div>
          <Field
            id="case-tags"
            label="Tags (optional)"
            hint="Comma-separated, e.g. smoke, refunds"
            error={errors.tags}
          >
            <Input
              id="case-tags"
              mono
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              data-testid="case-tags"
            />
          </Field>
          {errors.form ? (
            <p role="alert" className="text-[13px] text-fail">
              {errors.form}
            </p>
          ) : null}
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={save.isPending} data-testid="case-save">
              {testCase ? 'Save case' : 'Add case'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

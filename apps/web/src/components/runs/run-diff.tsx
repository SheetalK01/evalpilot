'use client';

import { cn } from '@/lib/cn';
import { formatPercent, shortId } from '@/lib/format';
import { useCompare } from '@/lib/queries';
import { Panel } from '../instruments/panel';
import { ErrorState, ScanRows } from '../instruments/states';
import { Tag } from '../instruments/status';

const LABEL = { PASSED: 'PASS', FAILED: 'FAIL', ERROR: 'ERROR' } as const;

/** Two runs side by side, like a code diff: regressions in red, fixes in green. */
export function RunDiff({ headId, baseId }: { headId: string; baseId: string }) {
  const diff = useCompare(headId, baseId);
  return (
    <Panel
      title={
        diff.data ? `DIFF · RUN ${shortId(diff.data.base.id)} → RUN ${shortId(diff.data.head.id)}` : 'DIFF'
      }
      bodyClassName="p-0"
      data-testid="run-diff"
      action={
        diff.data ? (
          <div className="flex items-center gap-2">
            <Tag tone={diff.data.regressions ? 'fail' : 'muted'}>{diff.data.regressions} regressed</Tag>
            <Tag tone={diff.data.fixes ? 'pass' : 'muted'}>{diff.data.fixes} fixed</Tag>
          </div>
        ) : null
      }
    >
      {diff.isLoading ? (
        <ScanRows className="p-4" rows={4} />
      ) : diff.error ? (
        <ErrorState className="m-4" error={diff.error} />
      ) : diff.data ? (
        <div className="num text-[12.5px]">
          <div className="label-mono grid grid-cols-[24px_minmax(0,1fr)_72px_72px] gap-3 border-b border-line px-4 py-2.5 sm:grid-cols-[24px_minmax(0,1fr)_96px_96px_140px]">
            <span />
            <span>CASE</span>
            <span>BEFORE · {formatPercent(diff.data.base.passRate)}</span>
            <span>AFTER · {formatPercent(diff.data.head.passRate)}</span>
            <span className="hidden sm:block">CHANGE</span>
          </div>
          <ul>
            {diff.data.cases.map((row) => {
              const regressed = row.change === 'PASS_TO_FAIL';
              const fixed = row.change === 'FAIL_TO_PASS';
              return (
                <li
                  key={row.key}
                  data-testid="diff-row"
                  data-change={row.change}
                  className={cn(
                    'grid grid-cols-[24px_minmax(0,1fr)_72px_72px] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0 sm:grid-cols-[24px_minmax(0,1fr)_96px_96px_140px]',
                    regressed && 'bg-[color-mix(in_oklab,var(--fail)_9%,transparent)]',
                    fixed && 'bg-[color-mix(in_oklab,var(--pass)_9%,transparent)]',
                  )}
                >
                  <span
                    className={cn(
                      'text-center',
                      regressed ? 'text-fail' : fixed ? 'text-pass' : 'text-muted',
                    )}
                  >
                    {regressed
                      ? '−'
                      : fixed
                        ? '+'
                        : row.change === 'ADDED'
                          ? '+'
                          : row.change === 'REMOVED'
                            ? '−'
                            : ' '}
                  </span>
                  <span className={cn('truncate', row.change === 'UNCHANGED' ? 'text-muted' : 'text-text')}>
                    {row.caseName}
                  </span>
                  <span
                    className={row.base === 'PASSED' ? 'text-pass' : row.base ? 'text-fail' : 'text-muted'}
                  >
                    {row.base ? LABEL[row.base] : '—'}
                  </span>
                  <span
                    className={row.head === 'PASSED' ? 'text-pass' : row.head ? 'text-fail' : 'text-muted'}
                  >
                    {row.head ? LABEL[row.head] : '—'}
                  </span>
                  <span
                    className={cn(
                      'hidden sm:block',
                      regressed ? 'text-fail' : fixed ? 'text-pass' : 'text-muted',
                    )}
                  >
                    {regressed
                      ? 'PASS → FAIL'
                      : fixed
                        ? 'FAIL → PASS'
                        : row.change === 'UNCHANGED'
                          ? 'unchanged'
                          : row.change.toLowerCase()}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}

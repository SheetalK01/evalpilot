import type { RunListItemResponse } from '@evalpilot/shared';
import Link from 'next/link';
import { formatPercent, formatRelative, shortId } from '@/lib/format';
import { MiniStrip } from '../instruments/flight-strip';
import { StatusTag } from '../instruments/status';

/** Compact run history: status, suite, mini flight strip, pass rate, when. */
export function RunRows({ runs, showSuite = true }: { runs: RunListItemResponse[]; showSuite?: boolean }) {
  return (
    <ul className="divide-y divide-line" data-testid="run-list">
      {runs.map((run) => (
        <li key={run.id}>
          <Link
            href={`/app/runs/${run.id}`}
            data-testid="run-row"
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-panel-2 sm:grid-cols-[96px_minmax(0,1fr)_120px_64px_96px]"
          >
            <StatusTag status={run.status} />
            <span className="min-w-0">
              <span className="block truncate text-sm text-text">
                {showSuite ? run.suiteName : `Run ${shortId(run.id)}`}
              </span>
              <span className="num block truncate text-[11px] text-muted">
                {run.trigger}
                {run.commitSha ? ` · ${run.commitSha.slice(0, 7)}` : ''} · #{shortId(run.id)}
              </span>
            </span>
            <MiniStrip strip={run.strip} total={run.total} className="hidden sm:flex" />
            <span className="num text-right text-sm text-text">{formatPercent(run.passRate)}</span>
            <span className="num col-span-3 text-[11px] text-muted sm:col-span-1 sm:text-right">
              {formatRelative(run.createdAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

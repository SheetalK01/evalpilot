import type { ResultStatus } from '../enums';

export type CaseChange = 'PASS_TO_FAIL' | 'FAIL_TO_PASS' | 'UNCHANGED' | 'ADDED' | 'REMOVED';

export interface DiffInput {
  testCaseId: string | null;
  caseName: string;
  status: ResultStatus;
}

export interface CaseDiff {
  key: string;
  caseName: string;
  base: ResultStatus | null;
  head: ResultStatus | null;
  change: CaseChange;
}

export interface RunDiff {
  cases: CaseDiff[];
  regressions: number;
  fixes: number;
}

const isPass = (status: ResultStatus) => status === 'PASSED';
const keyOf = (result: DiffInput) => result.testCaseId ?? `name:${result.caseName}`;

function classify(base: ResultStatus | null, head: ResultStatus | null): CaseChange {
  if (base === null) return 'ADDED';
  if (head === null) return 'REMOVED';
  if (isPass(base) && !isPass(head)) return 'PASS_TO_FAIL';
  if (!isPass(base) && isPass(head)) return 'FAIL_TO_PASS';
  return 'UNCHANGED';
}

const CHANGE_ORDER: Record<CaseChange, number> = {
  PASS_TO_FAIL: 0,
  FAIL_TO_PASS: 1,
  ADDED: 2,
  REMOVED: 3,
  UNCHANGED: 4,
};

/** Compares two runs case by case. Regressions are listed first. */
export function diffRuns(base: readonly DiffInput[], head: readonly DiffInput[]): RunDiff {
  const baseByKey = new Map(base.map((result) => [keyOf(result), result]));
  const headByKey = new Map(head.map((result) => [keyOf(result), result]));
  const keys = [...new Set([...headByKey.keys(), ...baseByKey.keys()])];
  const cases = keys.map((key): CaseDiff => {
    const b = baseByKey.get(key);
    const h = headByKey.get(key);
    return {
      key,
      caseName: h?.caseName ?? b?.caseName ?? key,
      base: b?.status ?? null,
      head: h?.status ?? null,
      change: classify(b?.status ?? null, h?.status ?? null),
    };
  });
  cases.sort((a, b) => CHANGE_ORDER[a.change] - CHANGE_ORDER[b.change]);
  return {
    cases,
    regressions: cases.filter((c) => c.change === 'PASS_TO_FAIL').length,
    fixes: cases.filter((c) => c.change === 'FAIL_TO_PASS').length,
  };
}

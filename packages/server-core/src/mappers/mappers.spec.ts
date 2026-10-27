import { Prisma, type Attack, type RedteamFinding, type TestResult } from '@prisma/client';
import { resultStrip, toRunResponse, toTestResultResponse, type RunWithSuite } from './run.mapper';
import { toRedteamReport, toRedteamRunResponse, type RedteamRunWithTarget } from './redteam.mapper';

const date = new Date('2026-10-26T10:00:00.000Z');
const decimal = (value: number) => new Prisma.Decimal(value);

const run: RunWithSuite = {
  id: 'run1',
  suiteId: 's1',
  status: 'PASSED',
  trigger: 'CLI',
  commitSha: 'abc1234',
  total: 2,
  passed: 2,
  failed: 0,
  passRate: 1,
  avgLatencyMs: 120,
  totalTokens: 300,
  estCostUsd: decimal(0.0042),
  startedAt: date,
  finishedAt: null,
  error: null,
  createdAt: date,
  updatedAt: date,
  suite: { name: 'Core', projectId: 'p1', passThreshold: 0.9 },
};

const result = (overrides: Partial<TestResult> = {}): TestResult => ({
  id: 'r1',
  runId: 'run1',
  testCaseId: 'c1',
  caseName: 'Refund',
  position: 0,
  status: 'PASSED',
  output: '30 days',
  latencyMs: 100,
  tokens: 150,
  estCostUsd: decimal(0.001),
  error: null,
  checkResultsJson: [{ type: 'contains', passed: true, message: 'ok' }, { bogus: true }],
  judgeScore: null,
  judgeReason: null,
  createdAt: date,
  ...overrides,
});

describe('run mappers', () => {
  it('maps a run with suite fields, numbers and ISO dates', () => {
    expect(toRunResponse(run)).toMatchObject({
      suiteName: 'Core',
      projectId: 'p1',
      passThreshold: 0.9,
      estCostUsd: 0.0042,
      startedAt: '2026-10-26T10:00:00.000Z',
      finishedAt: null,
    });
  });

  it('maps a result and drops unreadable check results', () => {
    expect(toTestResultResponse(result())).toMatchObject({
      estCostUsd: 0.001,
      checkResults: [{ type: 'contains', passed: true, message: 'ok' }],
    });
    expect(toTestResultResponse(result({ checkResultsJson: 'broken' })).checkResults).toEqual([]);
  });

  it('builds the status strip in suite order', () => {
    expect(
      resultStrip([
        result({ position: 2, status: 'ERROR' }),
        result({ position: 0 }),
        result({ position: 1, status: 'FAILED' }),
      ]),
    ).toBe('PFE');
    expect(resultStrip([])).toBe('');
  });
});

describe('red-team mappers', () => {
  const redteamRun: RedteamRunWithTarget = {
    id: 'rt1',
    projectId: 'p1',
    targetId: 't1',
    status: 'COMPLETED',
    total: 3,
    vulnerable: 2,
    riskScore: 75,
    startedAt: date,
    finishedAt: date,
    error: null,
    createdAt: date,
    updatedAt: date,
    target: { name: 'ShopBot' },
  };
  const attack = (id: string, category: Attack['category'], severity: Attack['severity']): Attack => ({
    id,
    category,
    name: `Attack ${id}`,
    prompt: 'p',
    detectionJson: [],
    severity,
    createdAt: date,
    updatedAt: date,
  });
  const finding = (a: Attack, vulnerable: boolean): RedteamFinding & { attack: Attack } => ({
    id: `f-${a.id}`,
    redteamRunId: 'rt1',
    attackId: a.id,
    output: 'o',
    vulnerable,
    evidence: vulnerable ? 'evidence' : null,
    severity: a.severity,
    createdAt: date,
    attack: a,
  });

  it('maps a run with its risk level, or none while unscored', () => {
    expect(toRedteamRunResponse(redteamRun)).toMatchObject({ targetName: 'ShopBot', riskLevel: 'CRITICAL' });
    expect(toRedteamRunResponse({ ...redteamRun, riskScore: null, target: null })).toMatchObject({
      targetName: null,
      riskLevel: null,
    });
  });

  it('orders findings vulnerable first, then by severity, and adds fix tips and a breakdown', () => {
    const report = toRedteamReport(redteamRun, [
      finding(attack('a', 'OFF_TOPIC', 'LOW'), false),
      finding(attack('b', 'JAILBREAK', 'MEDIUM'), true),
      finding(attack('c', 'PII_LEAK', 'CRITICAL'), true),
    ]);
    expect(report.findings.map((f) => f.attackId)).toEqual(['c', 'b', 'a']);
    expect(report.findings[0]?.fixTip).toContain('authenticated customer');
    expect(report.categories.find((c) => c.category === 'PII_LEAK')).toEqual({
      category: 'PII_LEAK',
      total: 1,
      vulnerable: 1,
      score: 100,
    });
  });
});

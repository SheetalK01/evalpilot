import type { Attack, Prisma, RedteamFinding, RedteamRun } from '@prisma/client';
import {
  categoryBreakdown,
  FIX_TIPS,
  type RedteamFindingResponse,
  type RedteamReportResponse,
  type RedteamRunResponse,
  riskLevel,
} from '@evalpilot/shared';

export const REDTEAM_RUN_INCLUDE = { target: { select: { name: true } } } satisfies Prisma.RedteamRunInclude;
export type RedteamRunWithTarget = RedteamRun & { target: { name: string } | null };
export type FindingWithAttack = RedteamFinding & { attack: Attack };

const iso = (date: Date | null) => date?.toISOString() ?? null;

export function toRedteamRunResponse(run: RedteamRunWithTarget): RedteamRunResponse {
  return {
    id: run.id,
    projectId: run.projectId,
    targetId: run.targetId,
    targetName: run.target?.name ?? null,
    status: run.status,
    total: run.total,
    vulnerable: run.vulnerable,
    riskScore: run.riskScore,
    riskLevel: run.riskScore === null ? null : riskLevel(run.riskScore),
    startedAt: iso(run.startedAt),
    finishedAt: iso(run.finishedAt),
    error: run.error,
    createdAt: run.createdAt.toISOString(),
  };
}

export function toFindingResponse(finding: FindingWithAttack): RedteamFindingResponse {
  return {
    id: finding.id,
    redteamRunId: finding.redteamRunId,
    attackId: finding.attackId,
    attackName: finding.attack.name,
    category: finding.attack.category,
    prompt: finding.attack.prompt,
    severity: finding.severity,
    vulnerable: finding.vulnerable,
    output: finding.output,
    evidence: finding.evidence,
    fixTip: FIX_TIPS[finding.attack.category],
    createdAt: finding.createdAt.toISOString(),
  };
}

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

/** Full report: run, per-category breakdown, and findings (vulnerable first, then by severity). */
export function toRedteamReport(
  run: RedteamRunWithTarget,
  findings: readonly FindingWithAttack[],
): RedteamReportResponse {
  const mapped = findings
    .map(toFindingResponse)
    .sort(
      (a, b) =>
        Number(b.vulnerable) - Number(a.vulnerable) ||
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.createdAt.localeCompare(b.createdAt),
    );
  return {
    ...toRedteamRunResponse(run),
    categories: categoryBreakdown(
      mapped.map((finding) => ({
        category: finding.category,
        severity: finding.severity,
        vulnerable: finding.vulnerable,
      })),
    ),
    findings: mapped,
  };
}

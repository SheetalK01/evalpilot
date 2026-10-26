import { detectRefusal, mockJudge } from '@evalpilot/shared';
import type { AttackVerdict, Judge, RefusalVerdict, ScoreVerdict } from './judge';

/** Deterministic judge: keyword scoring and the refusal heuristic. Labelled "[mock]" in results. */
export class MockJudge implements Judge {
  readonly mode = 'mock' as const;

  score(input: { criteria: string; output: string }): Promise<ScoreVerdict> {
    return Promise.resolve({ ...mockJudge(input.criteria, input.output), usage: null });
  }

  classifyRefusal(input: { output: string }): Promise<RefusalVerdict> {
    const refused = detectRefusal(input.output);
    return Promise.resolve({
      refused,
      reason: `[mock] Refusal heuristic: ${refused ? 'refused' : 'answered'}`,
      usage: null,
    });
  }

  /** In mock mode only the attack's detection rules decide; the judge adds nothing. */
  assessAttack(): Promise<AttackVerdict> {
    return Promise.resolve({ vulnerable: false, reason: '[mock] Detection rules only', usage: null });
  }
}

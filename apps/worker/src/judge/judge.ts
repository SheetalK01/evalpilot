import type { AiMode, AttackCategory } from '@evalpilot/shared';

export interface JudgeUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ScoreVerdict {
  /** 1–10 */
  score: number;
  reason: string;
  usage: JudgeUsage | null;
}

export interface RefusalVerdict {
  refused: boolean;
  reason: string;
  usage: JudgeUsage | null;
}

export interface AttackVerdict {
  vulnerable: boolean;
  reason: string;
  usage: JudgeUsage | null;
}

/** Grades answers. `mock` is deterministic and free (tests, CI, demos); `live` asks Claude. */
export interface Judge {
  readonly mode: AiMode;
  score(input: { criteria: string; prompt: string; output: string }): Promise<ScoreVerdict>;
  classifyRefusal(input: { prompt: string; output: string }): Promise<RefusalVerdict>;
  assessAttack(input: {
    category: AttackCategory;
    attackName: string;
    prompt: string;
    output: string;
  }): Promise<AttackVerdict>;
}

export const JUDGE = Symbol('JUDGE');

export class JudgeError extends Error {}

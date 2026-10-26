import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { AttackCategory } from '@evalpilot/shared';
import { z } from 'zod';
import {
  type AttackVerdict,
  type Judge,
  JudgeError,
  type JudgeUsage,
  type RefusalVerdict,
  type ScoreVerdict,
} from './judge';
import { attackPrompt, JUDGE_SYSTEM, refusalPrompt, scorePrompt } from './prompts';

/** Models that accept server-side refusal fallbacks (`fallbacks: "default"`). */
const FALLBACK_MODELS = new Set([
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
]);
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const scoreSchema = z.object({ score: z.number().describe('Integer from 1 to 10'), reason: z.string() });
const refusalSchema = z.object({ refused: z.boolean(), reason: z.string() });
const attackSchema = z.object({ attack_succeeded: z.boolean(), reason: z.string() });

export interface AnthropicJudgeOptions {
  apiKey: string;
  model: string;
  effort: 'low' | 'medium' | 'high';
  client?: Anthropic;
}

/**
 * Claude as judge, with structured JSON output (`client.beta.messages.parse` + zod schema).
 * Thinking is left to the model's default (adaptive); `effort` controls depth and cost.
 */
export class AnthropicJudge implements Judge {
  readonly mode = 'live' as const;
  private readonly client: Anthropic;

  constructor(private readonly options: AnthropicJudgeOptions) {
    this.client =
      options.client ?? new Anthropic({ apiKey: options.apiKey, maxRetries: 2, timeout: 120_000 });
  }

  private async ask<T extends z.ZodType>(
    schema: T,
    content: string,
  ): Promise<{ value: z.infer<T>; usage: JudgeUsage }> {
    const fallback = FALLBACK_MODELS.has(this.options.model)
      ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const }
      : {};
    const response = await this.client.beta.messages.parse({
      model: this.options.model,
      max_tokens: 4096,
      system: JUDGE_SYSTEM,
      messages: [{ role: 'user', content }],
      output_config: { effort: this.options.effort, format: betaZodOutputFormat(schema) },
      ...fallback,
    });
    if (response.stop_reason === 'refusal')
      throw new JudgeError('The judge model declined to grade this answer');
    if (response.stop_reason === 'max_tokens')
      throw new JudgeError('The judge ran out of tokens before answering');
    const value = response.parsed_output;
    if (value === null) throw new JudgeError('The judge returned an answer that did not match the schema');
    return {
      value,
      usage: {
        model: this.options.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  async score(input: { criteria: string; prompt: string; output: string }): Promise<ScoreVerdict> {
    const { value, usage } = await this.ask(
      scoreSchema,
      scorePrompt(input.criteria, input.prompt, input.output),
    );
    const score = Math.min(10, Math.max(1, Math.round(value.score)));
    return { score, reason: value.reason.trim(), usage };
  }

  async classifyRefusal(input: { prompt: string; output: string }): Promise<RefusalVerdict> {
    const { value, usage } = await this.ask(refusalSchema, refusalPrompt(input.prompt, input.output));
    return { refused: value.refused, reason: value.reason.trim(), usage };
  }

  async assessAttack(input: {
    category: AttackCategory;
    attackName: string;
    prompt: string;
    output: string;
  }): Promise<AttackVerdict> {
    const { value, usage } = await this.ask(
      attackSchema,
      attackPrompt(input.category, input.attackName, input.prompt, input.output),
    );
    return { vulnerable: value.attack_succeeded, reason: value.reason.trim(), usage };
  }
}

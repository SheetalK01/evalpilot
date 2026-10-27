/** USD per million tokens. Source: Anthropic pricing, October 2026. */
export const MODEL_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  'claude-fable-5-1': { inputPerMTok: 10, outputPerMTok: 50 },
  'claude-opus-5-5': { inputPerMTok: 4, outputPerMTok: 20 },
  'claude-opus-5': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-sonnet-5-5': { inputPerMTok: 2, outputPerMTok: 10 },
  'claude-sonnet-5': { inputPerMTok: 2, outputPerMTok: 10 },
  'claude-haiku-5-5': { inputPerMTok: 0.1, outputPerMTok: 0.5 },
  'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
};

export function isKnownModel(model: string | null | undefined): boolean {
  return model !== null && model !== undefined && model in MODEL_PRICING;
}

/** Estimated cost in USD, rounded to 6 decimals (the DB column precision). Unknown models cost 0. */
export function estimateCostUsd(
  model: string | null | undefined,
  inputTokens: number,
  outputTokens: number,
): number {
  if (!model) return 0;
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  const cost =
    (Math.max(0, inputTokens) * pricing.inputPerMTok + Math.max(0, outputTokens) * pricing.outputPerMTok) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Rough token estimate (~4 characters per token) for mock mode and targets that report no usage. */
export function estimateTokens(text: string): number {
  return text.length === 0 ? 0 : Math.ceil(text.length / 4);
}

import { estimateTokens } from './cost';

export interface CallUsage {
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  /** False when the target reported no usage and the counts are estimates. */
  reported: boolean;
}

const asCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;

/**
 * Reads token usage and model from a target's JSON response. Understands the Anthropic
 * (`usage.input_tokens`) and OpenAI-style (`usage.prompt_tokens`) shapes; otherwise estimates.
 */
export function extractUsage(body: unknown, input: string, output: string): CallUsage {
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const usage =
    typeof record.usage === 'object' && record.usage !== null
      ? (record.usage as Record<string, unknown>)
      : {};
  const inputTokens = asCount(usage.input_tokens) ?? asCount(usage.prompt_tokens);
  const outputTokens = asCount(usage.output_tokens) ?? asCount(usage.completion_tokens);
  const model = typeof record.model === 'string' && record.model.length <= 100 ? record.model : null;
  return {
    model,
    inputTokens: inputTokens ?? estimateTokens(input),
    outputTokens: outputTokens ?? estimateTokens(output),
    reported: inputTokens !== null && outputTokens !== null,
  };
}

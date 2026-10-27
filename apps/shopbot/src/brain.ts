import Anthropic from '@anthropic-ai/sdk';
import { estimateTokens } from '@evalpilot/shared';
import type { PromptVersion, ShopBotConfig } from './config';
import { systemPrompt } from './knowledge';
import { mockLatencyMs, mockReply, REFUSAL } from './mock-brain';

export interface BrainAnswer {
  reply: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface Brain {
  readonly mode: 'mock' | 'live';
  answer(message: string): Promise<BrainAnswer>;
}

export class MockBrain implements Brain {
  readonly mode = 'mock' as const;

  constructor(
    private readonly version: PromptVersion,
    private readonly model: string,
    private readonly delay: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async answer(message: string): Promise<BrainAnswer> {
    await this.delay(mockLatencyMs(message));
    const { reply } = mockReply(message, this.version);
    return {
      reply,
      model: this.model,
      inputTokens: estimateTokens(systemPrompt(this.version)) + estimateTokens(message),
      outputTokens: estimateTokens(reply),
    };
  }
}

/** Claude answers with the same system prompt (and canary). Chat replies are short, so effort is low. */
export class ClaudeBrain implements Brain {
  readonly mode = 'live' as const;

  constructor(
    private readonly version: PromptVersion,
    private readonly model: string,
    private readonly client: Pick<Anthropic, 'messages'>,
  ) {}

  async answer(message: string): Promise<BrainAnswer> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt(this.version),
      messages: [{ role: 'user', content: message }],
      output_config: { effort: 'low' },
    });
    const text = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('')
      .trim();
    return {
      // A safety decline from the model is still a valid, polite answer for a support bot.
      reply: response.stop_reason === 'refusal' || text === '' ? REFUSAL : text,
      model: this.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}

export function createBrain(config: ShopBotConfig): Brain {
  if (config.aiMode === 'live' && config.anthropicApiKey) {
    return new ClaudeBrain(
      config.promptVersion,
      config.model,
      new Anthropic({ apiKey: config.anthropicApiKey, maxRetries: 2, timeout: 60_000 }),
    );
  }
  return new MockBrain(config.promptVersion, config.model);
}

import { z } from 'zod';

const optional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const schema = z
  .object({
    SHOPBOT_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
    SHOPBOT_HOST: z.string().default('0.0.0.0'),
    AI_MODE: z.enum(['mock', 'live']).default('mock'),
    ANTHROPIC_API_KEY: optional,
    ANTHROPIC_MODEL: z.string().trim().min(1).default('claude-opus-5-5'),
    /** v1 = the good prompt; v2 = a "cheaper" prompt that causes a regression (for the demo). */
    SHOPBOT_PROMPT_VERSION: z.enum(['v1', 'v2']).default('v1'),
    EVALPILOT_API_KEY: optional,
    EVALPILOT_URL: z.string().default('http://localhost:4000'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  })
  .refine((env) => env.AI_MODE === 'mock' || env.ANTHROPIC_API_KEY, {
    message: 'AI_MODE=live needs ANTHROPIC_API_KEY',
    path: ['ANTHROPIC_API_KEY'],
  });

export type PromptVersion = 'v1' | 'v2';

export interface ShopBotConfig {
  port: number;
  host: string;
  aiMode: 'mock' | 'live';
  anthropicApiKey: string | null;
  model: string;
  promptVersion: PromptVersion;
  evalpilot: { apiKey: string | null; url: string };
  logLevel: z.infer<typeof schema>['LOG_LEVEL'];
}

export function loadShopBotConfig(source: NodeJS.ProcessEnv = process.env): ShopBotConfig {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Invalid ShopBot configuration:\n${parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')}`,
    );
  }
  const env = parsed.data;
  return {
    port: env.SHOPBOT_PORT,
    host: env.SHOPBOT_HOST,
    aiMode: env.AI_MODE,
    anthropicApiKey: env.ANTHROPIC_API_KEY ?? null,
    model: env.ANTHROPIC_MODEL,
    promptVersion: env.SHOPBOT_PROMPT_VERSION,
    evalpilot: { apiKey: env.EVALPILOT_API_KEY ?? null, url: env.EVALPILOT_URL },
    logLevel: env.LOG_LEVEL,
  };
}

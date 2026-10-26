import { EvalPilot } from '@evalpilot/sdk';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Brain } from './brain';
import type { ShopBotConfig } from './config';

const chatBody = z.object({
  message: z.string().trim().min(1, 'message is required').max(4000),
  sessionId: z.string().max(64).optional(),
});

export interface AppDeps {
  config: ShopBotConfig;
  brain: Brain;
  /** Tracing client; omit to disable tracing. */
  tracer?: Pick<EvalPilot, 'trace' | 'shutdown'>;
}

/** POST /chat answers one message; every answer is traced to EvalPilot (when a key is set). */
export function buildApp({ config, brain, tracer }: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: config.logLevel === 'silent' ? false : { level: config.logLevel },
    bodyLimit: 64 * 1024,
  });

  app.get('/health', () => ({ status: 'ok', mode: brain.mode, promptVersion: config.promptVersion }));

  app.post('/chat', async (request, reply) => {
    const parsed = chatBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
          .join('; '),
      });
    }
    const { message, sessionId } = parsed.data;
    const run = () => brain.answer(message);
    const answer = tracer
      ? await tracer.trace(
          'shopbot.chat',
          {
            input: message,
            model: config.model,
            metadata: { promptVersion: config.promptVersion, mode: brain.mode, sessionId: sessionId ?? null },
          },
          run,
          (result) => ({
            output: result.reply,
            model: result.model,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
          }),
        )
      : await run();
    return {
      reply: answer.reply,
      model: answer.model,
      mode: brain.mode,
      promptVersion: config.promptVersion,
      usage: { input_tokens: answer.inputTokens, output_tokens: answer.outputTokens },
    };
  });

  app.addHook('onClose', async () => {
    await tracer?.shutdown();
  });

  return app;
}

export function createTracer(config: ShopBotConfig): EvalPilot | undefined {
  return config.evalpilot.apiKey
    ? new EvalPilot({ apiKey: config.evalpilot.apiKey, baseUrl: config.evalpilot.url })
    : undefined;
}

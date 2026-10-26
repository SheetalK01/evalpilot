import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@evalpilot/server-core';
import { AnthropicJudge } from './anthropic-judge';
import { JUDGE, type Judge } from './judge';
import { MockJudge } from './mock-judge';

export function createJudge(config: AppConfig): Judge {
  if (config.aiMode === 'mock') return new MockJudge();
  if (!config.anthropic.apiKey) throw new Error('AI_MODE=live needs ANTHROPIC_API_KEY');
  return new AnthropicJudge({
    apiKey: config.anthropic.apiKey,
    model: config.anthropic.model,
    effort: config.anthropic.judgeEffort,
  });
}

@Module({ providers: [{ provide: JUDGE, inject: [APP_CONFIG], useFactory: createJudge }], exports: [JUDGE] })
export class JudgeModule {}

import { Module } from '@nestjs/common';
import {
  APP_CONFIG,
  type AppConfig,
  ConfigModule,
  PrismaModule,
  RealtimePublisherModule,
  RedisModule,
  SecretBoxService,
} from '@evalpilot/server-core';
import { LoggerModule } from 'nestjs-pino';
import { HeartbeatService } from './heartbeat.service';
import { JudgeModule } from './judge/judge.module';
import { PingExecutor } from './ping/ping-executor';
import { QueueWorkersService } from './queue-workers.service';
import { RedteamExecutor } from './redteam/redteam-executor';
import { RunExecutor } from './runs/run-executor';
import { TargetClient } from './target/target-client';

/** The executors, without queue wiring. Integration tests use this to run jobs directly. */
@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.logLevel,
          customProps: () => ({ service: 'worker' }),
          ...(config.env === 'development'
            ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
            : {}),
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    RealtimePublisherModule,
    JudgeModule,
  ],
  providers: [SecretBoxService, TargetClient, RunExecutor, RedteamExecutor, PingExecutor],
  exports: [RunExecutor, RedteamExecutor, PingExecutor, TargetClient],
})
export class ExecutorsModule {}

@Module({ imports: [ExecutorsModule], providers: [QueueWorkersService, HeartbeatService] })
export class WorkerModule {}

import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import {
  type AppConfig,
  bullConnection,
  InjectConfig,
  type PingJob,
  type PingJobResult,
  QUEUE_NAMES,
  type RedteamJob,
  redisKeys,
  type TestRunJob,
} from '@evalpilot/server-core';
import { Worker } from 'bullmq';
import { PingExecutor } from './ping/ping-executor';
import { RedteamExecutor } from './redteam/redteam-executor';
import { RunExecutor } from './runs/run-executor';

/** Connects the executors to their BullMQ queues and closes them gracefully on shutdown. */
@Injectable()
export class QueueWorkersService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(QueueWorkersService.name);
  private workers: Worker[] = [];

  constructor(
    @InjectConfig() private readonly config: AppConfig,
    private readonly runs: RunExecutor,
    private readonly redteam: RedteamExecutor,
    private readonly ping: PingExecutor,
  ) {}

  onApplicationBootstrap(): void {
    const base = { prefix: redisKeys(this.config.redisPrefix).bullPrefix };
    const make = <T, R>(name: string, concurrency: number, handler: (data: T) => Promise<R>) => {
      const worker = new Worker<T, R>(name, (job) => handler(job.data), {
        ...base,
        connection: bullConnection(this.config),
        concurrency,
      });
      worker.on('failed', (job, error) => {
        this.logger.error({ err: error, queue: name, jobId: job?.id }, 'Job failed');
      });
      return worker;
    };
    this.workers = [
      make(QUEUE_NAMES.testRuns, this.config.workerConcurrency, (data: TestRunJob) =>
        this.runs.execute(data.runId),
      ),
      make(QUEUE_NAMES.redteam, this.config.workerConcurrency, (data: RedteamJob) =>
        this.redteam.execute(data),
      ),
      make(QUEUE_NAMES.targetPing, 8, (data: PingJob): Promise<PingJobResult> =>
        this.ping.execute(data.targetId),
      ),
    ];
    this.logger.log(`Listening on queues: ${Object.values(QUEUE_NAMES).join(', ')}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled(this.workers.map((worker) => worker.close()));
  }
}

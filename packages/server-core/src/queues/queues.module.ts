import { Global, Inject, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { type ConnectionOptions, Queue, QueueEvents } from 'bullmq';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { redisKeys } from '../redis/keys';
import {
  DEFAULT_JOB_OPTIONS,
  type PingJob,
  type PingJobResult,
  QUEUE_NAMES,
  type RedteamJob,
  type TestRunJob,
} from './jobs';

/**
 * Connection *options* (not an ioredis instance) so BullMQ creates its own connections and also
 * closes them on `close()`. Workers need `maxRetriesPerRequest: null` (blocking commands).
 */
export function bullConnection(config: AppConfig): ConnectionOptions {
  const url = new URL(config.redisUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.pathname.length > 1 ? { db: Number(url.pathname.slice(1)) } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

export class WorkerUnavailableError extends Error {
  constructor() {
    super('The worker did not answer in time. Is it running?');
  }
}

/** Producer side of the queues, used by the API. Long work never runs in the request path. */
@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly testRuns: Queue<TestRunJob>;
  private readonly redteam: Queue<RedteamJob>;
  private readonly ping: Queue<PingJob, PingJobResult>;
  private pingEvents: QueueEvents | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    const options = {
      connection: bullConnection(config),
      prefix: redisKeys(config.redisPrefix).bullPrefix,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    };
    this.testRuns = new Queue(QUEUE_NAMES.testRuns, options);
    this.redteam = new Queue(QUEUE_NAMES.redteam, options);
    this.ping = new Queue(QUEUE_NAMES.targetPing, options);
  }

  /** The job id is the run id, so enqueueing the same run twice is a no-op. */
  async enqueueTestRun(runId: string): Promise<void> {
    await this.testRuns.add('run', { runId }, { jobId: runId });
  }

  async enqueueRedteam(job: RedteamJob): Promise<void> {
    await this.redteam.add('redteam', job, { jobId: job.redteamRunId });
  }

  /** Removes a run that has not started yet. Returns false if a worker already picked it up. */
  async removeQueuedTestRun(runId: string): Promise<boolean> {
    const job = await this.testRuns.getJob(runId);
    if (!job) return false;
    if (!(await job.isWaiting()) && !(await job.isDelayed())) return false;
    await job.remove();
    return true;
  }

  /** Asks the worker to make one call to the target and waits for the answer. */
  async pingTarget(targetId: string, timeoutMs: number): Promise<PingJobResult> {
    this.pingEvents ??= new QueueEvents(QUEUE_NAMES.targetPing, {
      connection: bullConnection(this.config),
      prefix: redisKeys(this.config.redisPrefix).bullPrefix,
    });
    await this.pingEvents.waitUntilReady();
    const job = await this.ping.add('ping', { targetId }, { removeOnComplete: true, removeOnFail: true });
    try {
      return await job.waitUntilFinished(this.pingEvents, timeoutMs);
    } catch (error) {
      if (error instanceof Error && /timed out/i.test(error.message)) throw new WorkerUnavailableError();
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.testRuns.close(),
      this.redteam.close(),
      this.ping.close(),
      this.pingEvents?.close(),
    ]);
  }
}

@Global()
@Module({ providers: [JobsService], exports: [JobsService] })
export class QueuesModule {}

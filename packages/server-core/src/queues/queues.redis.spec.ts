import { randomBytes } from 'node:crypto';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import type { AppConfig } from '../config/env';
import { RealtimePublisher } from '../realtime/realtime-publisher';
import { redisKeys } from '../redis/keys';
import { QUEUE_NAMES, type TestRunJob } from './jobs';
import { bullConnection, JobsService, WorkerUnavailableError } from './queues.module';

/** Uses the local Redis (CI: service container) under a throwaway prefix. */
const config = {
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  redisPrefix: `evalpilot-test-${randomBytes(4).toString('hex')}`,
} as AppConfig;
const prefix = redisKeys(config.redisPrefix).bullPrefix;

describe('JobsService (real Redis)', () => {
  let jobs: JobsService;
  let inspect: Queue<TestRunJob>;

  beforeAll(() => {
    jobs = new JobsService(config);
    inspect = new Queue(QUEUE_NAMES.testRuns, { connection: bullConnection(config), prefix });
  });

  afterAll(async () => {
    await inspect.obliterate({ force: true });
    await inspect.close();
    await jobs.onModuleDestroy();
  });

  it('enqueues a run once, using the run id as job id', async () => {
    await jobs.enqueueTestRun('run-1');
    await jobs.enqueueTestRun('run-1');
    expect((await inspect.getJobCounts('waiting')).waiting).toBe(1);
    expect((await inspect.getJob('run-1'))?.data).toEqual({ runId: 'run-1' });
  });

  it('removes a job that is still waiting, but not an unknown one', async () => {
    await jobs.enqueueTestRun('run-2');
    expect(await jobs.removeQueuedTestRun('run-2')).toBe(true);
    expect(await inspect.getJob('run-2')).toBeUndefined();
    expect(await jobs.removeQueuedTestRun('run-unknown')).toBe(false);
  });

  it('does not remove a job a worker already started', async () => {
    let release: () => void = () => undefined;
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => (markStarted = resolve));
    const worker = new Worker<TestRunJob>(
      QUEUE_NAMES.testRuns,
      async (job) => {
        if (job.id !== 'run-3') return;
        markStarted();
        await new Promise<void>((done) => (release = done));
      },
      { connection: bullConnection(config), prefix },
    );
    try {
      await jobs.enqueueTestRun('run-3');
      await started;
      expect(await jobs.removeQueuedTestRun('run-3')).toBe(false);
    } finally {
      release();
      await worker.close();
    }
  });

  it('round-trips a ping through a worker and times out without one', async () => {
    const pingWorker = new Worker(
      QUEUE_NAMES.targetPing,
      (job) =>
        Promise.resolve({
          ok: true,
          latencyMs: 5,
          outputPreview: `pong ${String(job.data.targetId)}`,
          error: null,
        }),
      {
        connection: bullConnection(config),
        prefix,
      },
    );
    try {
      await expect(jobs.pingTarget('t1', 5000)).resolves.toEqual({
        ok: true,
        latencyMs: 5,
        outputPreview: 'pong t1',
        error: null,
      });
    } finally {
      await pingWorker.close();
    }
    await expect(jobs.pingTarget('t2', 300)).rejects.toBeInstanceOf(WorkerUnavailableError);
  });

  it('queues red-team jobs with their categories', async () => {
    await jobs.enqueueRedteam({ redteamRunId: 'rt-1', categories: ['PII_LEAK'] });
    const redteam = new Queue(QUEUE_NAMES.redteam, { connection: bullConnection(config), prefix });
    try {
      expect((await redteam.getJob('rt-1'))?.data).toEqual({
        redteamRunId: 'rt-1',
        categories: ['PII_LEAK'],
      });
    } finally {
      await redteam.obliterate({ force: true });
      await redteam.close();
    }
  });
});

describe('RealtimePublisher (real Redis)', () => {
  it('publishes an envelope on the prefixed channel', async () => {
    const redis = new Redis(config.redisUrl);
    const subscriber = new Redis(config.redisUrl);
    try {
      const received = new Promise<string>((resolve) =>
        subscriber.on('message', (_channel: string, message: string) => resolve(message)),
      );
      await subscriber.subscribe(redisKeys(config.redisPrefix).realtimeChannel);
      await new RealtimePublisher(redis, config).publish('run', 'abc', 'run.progress', {
        runId: 'abc',
        done: 1,
        total: 2,
      });
      expect(JSON.parse(await received)).toEqual({
        room: 'run:abc',
        event: 'run.progress',
        payload: { runId: 'abc', done: 1, total: 2 },
      });
    } finally {
      await Promise.all([redis.quit(), subscriber.quit()]);
    }
  });
});

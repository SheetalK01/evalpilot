import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  type CreateRunInput,
  diffRuns,
  type Paginated,
  type PaginationQuery,
  REALTIME_EVENTS,
  type RunCreatedResponse,
  type RunDiffResponse,
  type RunListItemResponse,
  type RunResponse,
  type RunTrigger,
  type TestResultResponse,
} from '@evalpilot/shared';
import {
  JobsService,
  PrismaService,
  RealtimePublisher,
  resultStrip,
  RUN_INCLUDE,
  type RunWithSuite,
  toRunResponse,
  toTestResultResponse,
} from '@evalpilot/server-core';
import { NEWEST_FIRST, paginate } from '../common/pagination';

const ACTIVE = ['QUEUED', 'RUNNING'] as const;

@Injectable()
export class RunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly realtime: RealtimePublisher,
  ) {}

  /**
   * Creates a QUEUED run and hands it to the worker. Returns immediately (202): the API never calls
   * targets or Claude in the request path. `suiteWhere` scopes the suite to its owner or API key.
   */
  async start(
    suiteWhere: Prisma.TestSuiteWhereInput,
    trigger: RunTrigger,
    input: CreateRunInput,
  ): Promise<RunCreatedResponse> {
    const suite = await this.prisma.testSuite.findFirst({
      where: suiteWhere,
      include: { _count: { select: { cases: true } } },
    });
    if (!suite) throw new NotFoundException('Suite not found');
    if (!suite.targetId) throw new BadRequestException('Choose a target for this suite before running it');
    if (suite._count.cases === 0)
      throw new BadRequestException('Add at least one test case before running the suite');

    const run = await this.prisma.testRun.create({
      data: {
        suiteId: suite.id,
        status: 'QUEUED',
        trigger,
        commitSha: input.commitSha ?? null,
        total: suite._count.cases,
      },
    });
    try {
      await this.jobs.enqueueTestRun(run.id);
    } catch {
      await this.prisma.testRun.update({
        where: { id: run.id },
        data: { status: 'ERROR', error: 'Could not queue the run', finishedAt: new Date() },
      });
      throw new ServiceUnavailableException('The run queue is unavailable. Is Redis running?');
    }
    return { runId: run.id, status: run.status };
  }

  startForOwner(ownerId: string, suiteId: string, input: CreateRunInput): Promise<RunCreatedResponse> {
    return this.start({ id: suiteId, project: { ownerId } }, input.trigger ?? 'UI', input);
  }

  async listForSuite(
    ownerId: string,
    suiteId: string,
    query: PaginationQuery,
  ): Promise<Paginated<RunListItemResponse>> {
    const suite = await this.prisma.testSuite.findFirst({
      where: { id: suiteId, project: { ownerId } },
      select: { id: true },
    });
    if (!suite) throw new NotFoundException('Suite not found');
    const page = await paginate(query, (args) =>
      this.prisma.testRun.findMany({
        where: { suiteId },
        orderBy: NEWEST_FIRST,
        include: RUN_INCLUDE,
        ...args,
      }),
    );
    const results = await this.prisma.testResult.findMany({
      where: { runId: { in: page.items.map((run) => run.id) } },
      select: { runId: true, status: true, position: true },
    });
    return {
      items: page.items.map((run) => ({
        ...toRunResponse(run),
        strip: resultStrip(results.filter((result) => result.runId === run.id)),
      })),
      nextCursor: page.nextCursor,
    };
  }

  async findOwned(ownerId: string, runId: string): Promise<RunWithSuite> {
    const run = await this.prisma.testRun.findFirst({
      where: { id: runId, suite: { project: { ownerId } } },
      include: RUN_INCLUDE,
    });
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }

  async get(ownerId: string, runId: string): Promise<RunResponse> {
    return toRunResponse(await this.findOwned(ownerId, runId));
  }

  async results(ownerId: string, runId: string): Promise<TestResultResponse[]> {
    await this.findOwned(ownerId, runId);
    return this.resultsOf(runId);
  }

  private async resultsOf(runId: string): Promise<TestResultResponse[]> {
    const results = await this.prisma.testResult.findMany({
      where: { runId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return results.map(toTestResultResponse);
  }

  /**
   * A queued run is cancelled at once; a running one stops before its next test case
   * (the worker checks between cases and then publishes `run.completed`).
   */
  async cancel(ownerId: string, runId: string): Promise<RunResponse> {
    const run = await this.findOwned(ownerId, runId);
    if (!ACTIVE.includes(run.status as (typeof ACTIVE)[number]))
      throw new ConflictException('This run has already finished');

    const wasQueued = run.status === 'QUEUED' && (await this.jobs.removeQueuedTestRun(runId));
    const { count } = await this.prisma.testRun.updateMany({
      where: { id: runId, status: { in: [...ACTIVE] } },
      data: { status: 'CANCELLED', ...(wasQueued ? { finishedAt: new Date() } : {}) },
    });
    if (count === 0) throw new ConflictException('This run has already finished');

    const updated = toRunResponse(await this.findOwned(ownerId, runId));
    if (wasQueued)
      await this.realtime.publish('run', runId, REALTIME_EVENTS.runCompleted, {
        run: updated,
      });
    return updated;
  }

  /** `headId` is the newer run, `baseId` the one to compare against. Both must be from the same suite. */
  async compare(ownerId: string, headId: string, baseId: string): Promise<RunDiffResponse> {
    const [head, base] = await Promise.all([
      this.findOwned(ownerId, headId),
      this.findOwned(ownerId, baseId),
    ]);
    if (head.suiteId !== base.suiteId)
      throw new BadRequestException('Only runs of the same suite can be compared');
    const [headResults, baseResults] = await Promise.all([this.resultsOf(headId), this.resultsOf(baseId)]);
    return { base: toRunResponse(base), head: toRunResponse(head), ...diffRuns(baseResults, headResults) };
  }
}

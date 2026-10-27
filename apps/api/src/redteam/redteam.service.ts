import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  ATTACK_CATEGORIES,
  type AttackResponse,
  type Paginated,
  type PaginationQuery,
  type RedteamCreatedResponse,
  type RedteamReportResponse,
  type RedteamRunResponse,
  type StartRedteamInput,
} from '@evalpilot/shared';
import {
  JobsService,
  PrismaService,
  REDTEAM_RUN_INCLUDE,
  toRedteamReport,
  toRedteamRunResponse,
} from '@evalpilot/server-core';
import { NEWEST_FIRST, paginate } from '../common/pagination';
import { ProjectsService } from '../projects/projects.service';
import { TargetsService } from '../targets/targets.service';

@Injectable()
export class RedteamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly targets: TargetsService,
    private readonly jobs: JobsService,
  ) {}

  async attacks(): Promise<AttackResponse[]> {
    const attacks = await this.prisma.attack.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    return attacks
      .map(({ id, category, name, prompt, severity }) => ({ id, category, name, prompt, severity }))
      .sort((a, b) => ATTACK_CATEGORIES.indexOf(a.category) - ATTACK_CATEGORIES.indexOf(b.category));
  }

  async start(ownerId: string, targetId: string, input: StartRedteamInput): Promise<RedteamCreatedResponse> {
    const target = await this.targets.findOwned(ownerId, targetId);
    const total = await this.prisma.attack.count({
      where: input.categories ? { category: { in: input.categories } } : {},
    });
    const run = await this.prisma.redteamRun.create({
      data: { projectId: target.projectId, targetId, status: 'QUEUED', total },
    });
    try {
      await this.jobs.enqueueRedteam({
        redteamRunId: run.id,
        ...(input.categories ? { categories: input.categories } : {}),
      });
    } catch {
      await this.prisma.redteamRun.update({
        where: { id: run.id },
        data: { status: 'ERROR', error: 'Could not queue the red-team run', finishedAt: new Date() },
      });
      throw new ServiceUnavailableException('The run queue is unavailable. Is Redis running?');
    }
    return { redteamRunId: run.id, status: run.status };
  }

  async list(
    ownerId: string,
    projectId: string,
    query: PaginationQuery,
  ): Promise<Paginated<RedteamRunResponse>> {
    await this.projects.assertOwned(ownerId, projectId);
    const page = await paginate(query, (args) =>
      this.prisma.redteamRun.findMany({
        where: { projectId },
        orderBy: NEWEST_FIRST,
        include: REDTEAM_RUN_INCLUDE,
        ...args,
      }),
    );
    return { items: page.items.map(toRedteamRunResponse), nextCursor: page.nextCursor };
  }

  async report(ownerId: string, id: string): Promise<RedteamReportResponse> {
    const run = await this.prisma.redteamRun.findFirst({
      where: { id, project: { ownerId } },
      include: REDTEAM_RUN_INCLUDE,
    });
    if (!run) throw new NotFoundException('Red-team run not found');
    const findings = await this.prisma.redteamFinding.findMany({
      where: { redteamRunId: id },
      include: { attack: true },
    });
    return toRedteamReport(run, findings);
  }
}

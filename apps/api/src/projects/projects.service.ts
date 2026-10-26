import { Injectable, NotFoundException } from '@nestjs/common';
import type { Project } from '@prisma/client';
import type {
  CreateProjectInput,
  Paginated,
  PaginationQuery,
  ProjectResponse,
  UpdateProjectInput,
} from '@evalpilot/shared';
import { NEWEST_FIRST, paginate } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

const withCounts = { _count: { select: { suites: true, targets: true } } } as const;
type ProjectWithCounts = Project & { _count: { suites: number; targets: number } };

export function toProjectResponse(project: ProjectWithCounts): ProjectResponse {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    suiteCount: project._count.suites,
    targetCount: project._count.targets,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string, query: PaginationQuery): Promise<Paginated<ProjectResponse>> {
    const page = await paginate(query, (args) =>
      this.prisma.project.findMany({
        where: { ownerId },
        orderBy: NEWEST_FIRST,
        include: withCounts,
        ...args,
      }),
    );
    return { items: page.items.map(toProjectResponse), nextCursor: page.nextCursor };
  }

  async create(ownerId: string, input: CreateProjectInput): Promise<ProjectResponse> {
    const project = await this.prisma.project.create({
      data: { ownerId, name: input.name, description: input.description ?? null },
      include: withCounts,
    });
    return toProjectResponse(project);
  }

  async get(ownerId: string, id: string): Promise<ProjectResponse> {
    const project = await this.prisma.project.findFirst({ where: { id, ownerId }, include: withCounts });
    if (!project) throw new NotFoundException('Project not found');
    return toProjectResponse(project);
  }

  async update(ownerId: string, id: string, input: UpdateProjectInput): Promise<ProjectResponse> {
    await this.assertOwned(ownerId, id);
    const project = await this.prisma.project.update({
      where: { id },
      data: { name: input.name, description: input.description },
      include: withCounts,
    });
    return toProjectResponse(project);
  }

  /** Deletes the project and, through cascades, everything in it. */
  async remove(ownerId: string, id: string): Promise<void> {
    const { count } = await this.prisma.project.deleteMany({ where: { id, ownerId } });
    if (count === 0) throw new NotFoundException('Project not found');
  }

  /**
   * Ownership check used by every project-scoped module. Another user's project is reported as
   * "not found" (404), never "forbidden", so ids cannot be probed.
   */
  async assertOwned(ownerId: string, projectId: string): Promise<Project> {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, ownerId } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}

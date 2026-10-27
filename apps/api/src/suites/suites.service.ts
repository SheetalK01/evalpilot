import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Target, TestRun, TestSuite } from '@prisma/client';
import {
  type CreateSuiteInput,
  type CsvImportResultResponse,
  MAX_CASES_PER_SUITE,
  type Paginated,
  type PaginationQuery,
  parseTestCasesCsv,
  type SuiteResponse,
  testCasesToCsv,
  type UpdateSuiteInput,
} from '@evalpilot/shared';
import { NEWEST_FIRST, paginate } from '../common/pagination';
import { PrismaService } from '@evalpilot/server-core';
import { ProjectsService } from '../projects/projects.service';
import { parseStoredChecks, parseStoredTags } from '../test-cases/test-case.mapper';

const suiteInclude = {
  target: { select: { id: true, name: true, type: true } },
  runs: {
    orderBy: NEWEST_FIRST,
    take: 1,
    select: { id: true, status: true, passRate: true, createdAt: true },
  },
  _count: { select: { cases: true } },
} satisfies Prisma.TestSuiteInclude;

type SuiteRow = TestSuite & {
  target: Pick<Target, 'id' | 'name' | 'type'> | null;
  runs: Pick<TestRun, 'id' | 'status' | 'passRate' | 'createdAt'>[];
  _count: { cases: number };
};

export function toSuiteResponse(suite: SuiteRow): SuiteResponse {
  const lastRun = suite.runs[0];
  return {
    id: suite.id,
    projectId: suite.projectId,
    targetId: suite.targetId,
    target: suite.target,
    name: suite.name,
    description: suite.description,
    passThreshold: suite.passThreshold,
    caseCount: suite._count.cases,
    lastRun: lastRun ? { ...lastRun, createdAt: lastRun.createdAt.toISOString() } : null,
    createdAt: suite.createdAt.toISOString(),
    updatedAt: suite.updatedAt.toISOString(),
  };
}

/** File-name-safe version of the suite name for CSV downloads. */
export function csvFileName(suiteName: string): string {
  const slug = suiteName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'suite'}-cases.csv`;
}

@Injectable()
export class SuitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async list(ownerId: string, projectId: string, query: PaginationQuery): Promise<Paginated<SuiteResponse>> {
    await this.projects.assertOwned(ownerId, projectId);
    const page = await paginate(query, (args) =>
      this.prisma.testSuite.findMany({
        where: { projectId },
        orderBy: NEWEST_FIRST,
        include: suiteInclude,
        ...args,
      }),
    );
    return { items: page.items.map(toSuiteResponse), nextCursor: page.nextCursor };
  }

  async create(ownerId: string, projectId: string, input: CreateSuiteInput): Promise<SuiteResponse> {
    await this.projects.assertOwned(ownerId, projectId);
    if (input.targetId) await this.assertTargetInProject(input.targetId, projectId);
    const suite = await this.prisma.testSuite.create({
      data: {
        projectId,
        targetId: input.targetId ?? null,
        name: input.name,
        description: input.description ?? null,
        passThreshold: input.passThreshold,
      },
      include: suiteInclude,
    });
    return toSuiteResponse(suite);
  }

  async findOwned(ownerId: string, id: string): Promise<TestSuite> {
    const suite = await this.prisma.testSuite.findFirst({ where: { id, project: { ownerId } } });
    if (!suite) throw new NotFoundException('Suite not found');
    return suite;
  }

  async get(ownerId: string, id: string): Promise<SuiteResponse> {
    const suite = await this.prisma.testSuite.findFirst({
      where: { id, project: { ownerId } },
      include: suiteInclude,
    });
    if (!suite) throw new NotFoundException('Suite not found');
    return toSuiteResponse(suite);
  }

  async update(ownerId: string, id: string, input: UpdateSuiteInput): Promise<SuiteResponse> {
    const suite = await this.findOwned(ownerId, id);
    if (input.targetId) await this.assertTargetInProject(input.targetId, suite.projectId);
    const updated = await this.prisma.testSuite.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        targetId: input.targetId,
        passThreshold: input.passThreshold,
      },
      include: suiteInclude,
    });
    return toSuiteResponse(updated);
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const { count } = await this.prisma.testSuite.deleteMany({ where: { id, project: { ownerId } } });
    if (count === 0) throw new NotFoundException('Suite not found');
  }

  async exportCsv(ownerId: string, id: string): Promise<{ fileName: string; csv: string }> {
    const suite = await this.findOwned(ownerId, id);
    const cases = await this.prisma.testCase.findMany({
      where: { suiteId: id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const csv = testCasesToCsv(
      cases.map((testCase) => ({
        name: testCase.name,
        input: testCase.input,
        checks: parseStoredChecks(testCase.checksJson),
        tags: parseStoredTags(testCase.tags),
      })),
    );
    return { fileName: csvFileName(suite.name), csv };
  }

  /** Appends valid rows to the suite; invalid rows are reported with their line numbers. */
  async importCsv(ownerId: string, id: string, csvText: string): Promise<CsvImportResultResponse> {
    await this.findOwned(ownerId, id);
    const { cases, errors } = parseTestCasesCsv(csvText);
    if (cases.length === 0) return { imported: 0, errors };

    const existing = await this.prisma.testCase.aggregate({
      where: { suiteId: id },
      _count: true,
      _max: { position: true },
    });
    if (existing._count + cases.length > MAX_CASES_PER_SUITE) {
      throw new BadRequestException(`A suite can hold at most ${MAX_CASES_PER_SUITE} test cases`);
    }
    const start = (existing._max.position ?? -1) + 1;
    await this.prisma.testCase.createMany({
      data: cases.map((testCase, index) => ({
        suiteId: id,
        name: testCase.name,
        input: testCase.input,
        checksJson: testCase.checks as Prisma.InputJsonValue,
        tags: testCase.tags,
        position: start + index,
      })),
    });
    return { imported: cases.length, errors };
  }

  private async assertTargetInProject(targetId: string, projectId: string): Promise<void> {
    const target = await this.prisma.target.findFirst({
      where: { id: targetId, projectId },
      select: { id: true },
    });
    if (!target) throw new BadRequestException('Target not found in this project');
  }
}

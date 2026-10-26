import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, TestCase } from '@prisma/client';
import {
  type CreateTestCaseInput,
  MAX_CASES_PER_SUITE,
  type ReorderCasesInput,
  type TestCaseResponse,
  type UpdateTestCaseInput,
} from '@evalpilot/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SuitesService } from '../suites/suites.service';
import { toTestCaseResponse } from './test-case.mapper';

const BY_POSITION = [{ position: 'asc' as const }, { createdAt: 'asc' as const }];

@Injectable()
export class TestCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suites: SuitesService,
  ) {}

  /** All cases of a suite in run order (bounded by MAX_CASES_PER_SUITE, so not paginated). */
  async list(ownerId: string, suiteId: string): Promise<TestCaseResponse[]> {
    await this.suites.findOwned(ownerId, suiteId);
    const cases = await this.prisma.testCase.findMany({ where: { suiteId }, orderBy: BY_POSITION });
    return cases.map(toTestCaseResponse);
  }

  async create(ownerId: string, suiteId: string, input: CreateTestCaseInput): Promise<TestCaseResponse> {
    await this.suites.findOwned(ownerId, suiteId);
    const existing = await this.prisma.testCase.aggregate({
      where: { suiteId },
      _count: true,
      _max: { position: true },
    });
    if (existing._count >= MAX_CASES_PER_SUITE) {
      throw new BadRequestException(`A suite can hold at most ${MAX_CASES_PER_SUITE} test cases`);
    }
    const testCase = await this.prisma.testCase.create({
      data: {
        suiteId,
        name: input.name,
        input: input.input,
        checksJson: input.checks as Prisma.InputJsonValue,
        tags: input.tags,
        position: (existing._max.position ?? -1) + 1,
      },
    });
    return toTestCaseResponse(testCase);
  }

  private async findOwned(ownerId: string, id: string): Promise<TestCase> {
    const testCase = await this.prisma.testCase.findFirst({ where: { id, suite: { project: { ownerId } } } });
    if (!testCase) throw new NotFoundException('Test case not found');
    return testCase;
  }

  async update(ownerId: string, id: string, input: UpdateTestCaseInput): Promise<TestCaseResponse> {
    await this.findOwned(ownerId, id);
    const testCase = await this.prisma.testCase.update({
      where: { id },
      data: {
        name: input.name,
        input: input.input,
        checksJson: input.checks as Prisma.InputJsonValue | undefined,
        tags: input.tags,
      },
    });
    return toTestCaseResponse(testCase);
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const { count } = await this.prisma.testCase.deleteMany({
      where: { id, suite: { project: { ownerId } } },
    });
    if (count === 0) throw new NotFoundException('Test case not found');
  }

  /** `ids` must list every case of the suite exactly once, in the new order. */
  async reorder(ownerId: string, suiteId: string, input: ReorderCasesInput): Promise<TestCaseResponse[]> {
    await this.suites.findOwned(ownerId, suiteId);
    const current = await this.prisma.testCase.findMany({ where: { suiteId }, select: { id: true } });
    const currentIds = new Set(current.map((testCase) => testCase.id));
    if (input.ids.length !== currentIds.size || !input.ids.every((id) => currentIds.has(id))) {
      throw new BadRequestException('ids must list every test case in the suite exactly once');
    }
    await this.prisma.$transaction(
      input.ids.map((id, position) => this.prisma.testCase.update({ where: { id }, data: { position } })),
    );
    return this.list(ownerId, suiteId);
  }
}

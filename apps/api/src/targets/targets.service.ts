import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Target } from '@prisma/client';
import {
  type CreateTargetInput,
  type PingResultResponse,
  httpTargetSchema,
  maskHeaders,
  type TargetResponse,
  type UpdateTargetInput,
} from '@evalpilot/shared';
import { ZodValidationException } from 'nestjs-zod';
import { JobsService, PrismaService, SecretBoxService, WorkerUnavailableError } from '@evalpilot/server-core';
import { ProjectsService } from '../projects/projects.service';
import { mergeMaskedHeaders } from './target-headers';

const SHOPBOT_EDITABLE = new Set(['name', 'timeoutMs']);

@Injectable()
export class TargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly secrets: SecretBoxService,
    private readonly jobs: JobsService,
  ) {}

  toResponse(target: Target): TargetResponse {
    return {
      id: target.id,
      projectId: target.projectId,
      name: target.name,
      type: target.type,
      url: target.url,
      method: target.method,
      headers: maskHeaders(this.readHeaders(target)),
      bodyTemplate: target.bodyTemplate,
      responsePath: target.responsePath,
      timeoutMs: target.timeoutMs,
      createdAt: target.createdAt.toISOString(),
      updatedAt: target.updatedAt.toISOString(),
    };
  }

  /** Decrypted headers. Only the worker needs these in full; API responses mask them. */
  readHeaders(target: Pick<Target, 'headersJson'>): Record<string, string> {
    if (!target.headersJson) return {};
    return JSON.parse(this.secrets.open(target.headersJson)) as Record<string, string>;
  }

  private sealHeaders(headers: Record<string, string>): string | null {
    return Object.keys(headers).length === 0 ? null : this.secrets.seal(JSON.stringify(headers));
  }

  async list(ownerId: string, projectId: string): Promise<TargetResponse[]> {
    await this.projects.assertOwned(ownerId, projectId);
    const targets = await this.prisma.target.findMany({
      where: { projectId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return targets.map((target) => this.toResponse(target));
  }

  async create(ownerId: string, projectId: string, input: CreateTargetInput): Promise<TargetResponse> {
    await this.projects.assertOwned(ownerId, projectId);
    const data =
      input.type === 'HTTP'
        ? {
            type: input.type,
            name: input.name,
            url: input.url,
            method: input.method,
            headersJson: this.sealHeaders(input.headers),
            bodyTemplate: input.bodyTemplate ?? null,
            responsePath: input.responsePath,
            timeoutMs: input.timeoutMs,
          }
        : { type: input.type, name: input.name, timeoutMs: input.timeoutMs };
    const target = await this.prisma.target.create({ data: { projectId, ...data } });
    return this.toResponse(target);
  }

  async findOwned(ownerId: string, id: string): Promise<Target> {
    const target = await this.prisma.target.findFirst({ where: { id, project: { ownerId } } });
    if (!target) throw new NotFoundException('Target not found');
    return target;
  }

  async get(ownerId: string, id: string): Promise<TargetResponse> {
    return this.toResponse(await this.findOwned(ownerId, id));
  }

  async update(ownerId: string, id: string, input: UpdateTargetInput): Promise<TargetResponse> {
    const target = await this.findOwned(ownerId, id);
    if (target.type === 'SHOPBOT') {
      const invalid = Object.keys(input).filter(
        (key) => input[key as keyof UpdateTargetInput] !== undefined && !SHOPBOT_EDITABLE.has(key),
      );
      if (invalid.length > 0)
        throw new BadRequestException('ShopBot targets only support changing name and timeoutMs');
      const updated = await this.prisma.target.update({
        where: { id },
        data: { name: input.name, timeoutMs: input.timeoutMs },
      });
      return this.toResponse(updated);
    }

    const existingHeaders = this.readHeaders(target);
    // Validate the merged result, so rules that span fields (like the {{input}} placeholder) still hold.
    const merged = httpTargetSchema.safeParse({
      type: 'HTTP',
      name: input.name ?? target.name,
      url: input.url ?? target.url,
      method: input.method ?? target.method,
      headers: input.headers ? mergeMaskedHeaders(input.headers, existingHeaders) : existingHeaders,
      bodyTemplate: input.bodyTemplate ?? target.bodyTemplate ?? undefined,
      responsePath: input.responsePath ?? target.responsePath ?? undefined,
      timeoutMs: input.timeoutMs ?? target.timeoutMs,
    });
    if (!merged.success) throw new ZodValidationException(merged.error);
    const next = merged.data;
    const updated = await this.prisma.target.update({
      where: { id },
      data: {
        name: next.name,
        url: next.url,
        method: next.method,
        headersJson: this.sealHeaders(next.headers),
        bodyTemplate: next.bodyTemplate ?? null,
        responsePath: next.responsePath,
        timeoutMs: next.timeoutMs,
      },
    });
    return this.toResponse(updated);
  }

  /** One test call, made by the worker (the API never calls targets itself). */
  async ping(ownerId: string, id: string): Promise<PingResultResponse> {
    const target = await this.findOwned(ownerId, id);
    try {
      return await this.jobs.pingTarget(target.id, target.timeoutMs + 5000);
    } catch (error) {
      if (error instanceof WorkerUnavailableError) throw new ServiceUnavailableException(error.message);
      throw error;
    }
  }

  /** Suites that used this target keep their history and are unlinked (target_id = NULL). */
  async remove(ownerId: string, id: string): Promise<void> {
    const { count } = await this.prisma.target.deleteMany({ where: { id, project: { ownerId } } });
    if (count === 0) throw new NotFoundException('Target not found');
  }
}

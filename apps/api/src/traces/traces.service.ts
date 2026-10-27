import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Trace } from '@prisma/client';
import {
  estimateCostUsd,
  type Paginated,
  type PaginationQuery,
  type ParsedTraceInput,
  REALTIME_EVENTS,
  type TraceIngestResultResponse,
  type TraceListItemResponse,
  type TraceResponse,
  type UsageRange,
  type UsageResponse,
} from '@evalpilot/shared';
import { PrismaService, RealtimePublisher } from '@evalpilot/server-core';
import { paginate } from '../common/pagination';
import { ProjectsService } from '../projects/projects.service';
import type { ApiKeyContext } from '../types/auth';
import { aggregateUsage, rangeStart } from './usage';

const PREVIEW_CHARS = 200;
const preview = (text: string | null) =>
  text === null ? null : text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text;
const NEWEST_TRACES = [{ startedAt: 'desc' as const }, { id: 'desc' as const }];

export function toTraceListItem(trace: Trace): TraceListItemResponse {
  return {
    id: trace.id,
    projectId: trace.projectId,
    externalId: trace.externalId,
    name: trace.name,
    model: trace.model,
    inputPreview: preview(trace.input),
    outputPreview: preview(trace.output),
    latencyMs: trace.latencyMs,
    inputTokens: trace.inputTokens,
    outputTokens: trace.outputTokens,
    estCostUsd: trace.estCostUsd.toNumber(),
    status: trace.status,
    error: trace.error,
    startedAt: trace.startedAt.toISOString(),
    createdAt: trace.createdAt.toISOString(),
  };
}

export function toTraceResponse(trace: Trace): TraceResponse {
  return {
    ...toTraceListItem(trace),
    input: trace.input,
    output: trace.output,
    metadata: (trace.metadataJson as TraceResponse['metadata'] | null) ?? null,
  };
}

export interface TraceFilters {
  status?: 'OK' | 'ERROR' | undefined;
  search?: string | undefined;
}

@Injectable()
export class TracesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly realtime: RealtimePublisher,
  ) {}

  private toRow(projectId: string, input: ParsedTraceInput): Prisma.TraceUncheckedCreateInput {
    const inputTokens = input.inputTokens ?? 0;
    const outputTokens = input.outputTokens ?? 0;
    return {
      projectId,
      externalId: input.externalId ?? null,
      name: input.name,
      input: input.input ?? null,
      output: input.output ?? null,
      model: input.model ?? null,
      latencyMs: input.latencyMs,
      inputTokens,
      outputTokens,
      estCostUsd: estimateCostUsd(input.model, inputTokens, outputTokens),
      status: input.status,
      error: input.error ?? null,
      ...(input.metadata ? { metadataJson: input.metadata } : {}),
      startedAt: input.startedAt ? new Date(input.startedAt) : new Date(Date.now() - input.latencyMs),
    };
  }

  /**
   * Stores a batch from the SDK and pushes each trace to the project's live feed. A trace with an
   * `externalId` that was already stored is ignored, so SDK retries never create duplicates.
   */
  async ingest(apiKey: ApiKeyContext, traces: ParsedTraceInput[]): Promise<TraceIngestResultResponse> {
    const rows = traces.map((trace) => this.toRow(apiKey.projectId, trace));
    const saved = await this.prisma.$transaction(
      rows.map((row) =>
        row.externalId
          ? this.prisma.trace.upsert({
              where: { projectId_externalId: { projectId: apiKey.projectId, externalId: row.externalId } },
              create: row,
              update: {},
            })
          : this.prisma.trace.create({ data: row }),
      ),
    );
    for (const trace of saved) {
      await this.realtime.publish('project', apiKey.projectId, REALTIME_EVENTS.traceCreated, {
        trace: toTraceListItem(trace),
      });
    }
    return { accepted: saved.length };
  }

  async list(
    ownerId: string,
    projectId: string,
    query: PaginationQuery,
    filters: TraceFilters,
  ): Promise<Paginated<TraceListItemResponse>> {
    await this.projects.assertOwned(ownerId, projectId);
    const search = filters.search?.trim();
    const where: Prisma.TraceWhereInput = {
      projectId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { model: { contains: search } },
              { externalId: { contains: search } },
              { input: { contains: search } },
            ],
          }
        : {}),
    };
    const page = await paginate(query, (args) =>
      this.prisma.trace.findMany({ where, orderBy: NEWEST_TRACES, ...args }),
    );
    return { items: page.items.map(toTraceListItem), nextCursor: page.nextCursor };
  }

  async get(ownerId: string, id: string): Promise<TraceResponse> {
    const trace = await this.prisma.trace.findFirst({ where: { id, project: { ownerId } } });
    if (!trace) throw new NotFoundException('Trace not found');
    return toTraceResponse(trace);
  }

  async usage(
    ownerId: string,
    projectId: string,
    range: UsageRange,
    now = new Date(),
  ): Promise<UsageResponse> {
    await this.projects.assertOwned(ownerId, projectId);
    const rows = await this.prisma.trace.findMany({
      where: { projectId, startedAt: { gte: rangeStart(range, now) } },
      select: {
        startedAt: true,
        latencyMs: true,
        status: true,
        inputTokens: true,
        outputTokens: true,
        estCostUsd: true,
        model: true,
      },
    });
    return aggregateUsage(
      rows.map((row) => ({ ...row, costUsd: row.estCostUsd.toNumber() })),
      range,
      now,
    );
  }
}

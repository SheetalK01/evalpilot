import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ingestTracesSchema,
  normalizeTraceIngest,
  type Paginated,
  type TraceIngestResultResponse,
  type TraceListItemResponse,
  type TraceResponse,
  type UsageResponse,
} from '@evalpilot/shared';
import { ZodValidationPipe } from 'nestjs-zod';
import type { z } from 'zod';
import { ApiKeyAuth, CurrentApiKey, CurrentUser, SessionAuth } from '../common/decorators/auth.decorators';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import type { ApiKeyContext, AuthUser } from '../types/auth';
import {
  ingestTracesBody,
  TraceDto,
  TraceIngestResultDto,
  TracePageDto,
  TraceQueryDto,
  UsageDto,
  UsageQueryDto,
} from './traces.dto';
import { TracesService } from './traces.service';

@ApiTags('Traces')
@Controller()
export class TracesController {
  constructor(private readonly traces: TracesService) {}

  @ApiKeyAuth()
  @RateLimit('v1')
  @Post('v1/traces')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Ingest traces from the SDK (one, or a batch of up to 100). Auth: project API key.',
  })
  @ApiBody(ingestTracesBody)
  @ApiAcceptedResponse({ type: TraceIngestResultDto })
  ingest(
    @CurrentApiKey() apiKey: ApiKeyContext,
    @Body(new ZodValidationPipe(ingestTracesSchema)) body: z.output<typeof ingestTracesSchema>,
  ): Promise<TraceIngestResultResponse> {
    return this.traces.ingest(apiKey, normalizeTraceIngest(body));
  }

  @SessionAuth()
  @Get('projects/:projectId/traces')
  @ApiOperation({ summary: 'Traces, newest first; filter by status or search name, model, id and input' })
  @ApiOkResponse({ type: TracePageDto })
  @ApiNotFoundResponse({ description: 'Not found, or owned by another user' })
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query() query: TraceQueryDto,
  ): Promise<Paginated<TraceListItemResponse>> {
    return this.traces.list(user.id, projectId, query, { status: query.status, search: query.search });
  }

  @SessionAuth()
  @Get('traces/:id')
  @ApiOkResponse({ type: TraceDto })
  @ApiNotFoundResponse({ description: 'Not found, or owned by another user' })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<TraceResponse> {
    return this.traces.get(user.id, id);
  }

  @SessionAuth()
  @Get('projects/:projectId/usage')
  @ApiOperation({ summary: 'Requests, error rate, p95 latency, tokens and cost over 24h, 7d or 30d' })
  @ApiOkResponse({ type: UsageDto })
  @ApiNotFoundResponse({ description: 'Not found, or owned by another user' })
  usage(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query() query: UsageQueryDto,
  ): Promise<UsageResponse> {
    return this.traces.usage(user.id, projectId, query.range);
  }
}

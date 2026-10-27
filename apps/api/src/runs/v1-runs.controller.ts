import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { type RunCreatedResponse, type V1RunResponse, v1RunSchema } from '@evalpilot/shared';
import { createZodDto } from 'nestjs-zod';
import { ApiKeyAuth, CurrentApiKey } from '../common/decorators/auth.decorators';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import type { ApiKeyContext } from '../types/auth';
import { CreateRunDto, RunCreatedDto } from './runs.dto';
import { RunsService } from './runs.service';

class V1RunDto extends createZodDto(v1RunSchema) {}

/** Machine endpoints for the CLI / CI gate. Authenticated with a project API key. */
@ApiTags('CLI (API key)')
@ApiKeyAuth()
@RateLimit('v1')
@ApiNotFoundResponse({ description: 'Not found in the API key’s project' })
@Controller('v1')
export class V1RunsController {
  constructor(private readonly runs: RunsService) {}

  @Post('suites/:suiteId/runs')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start a run from CI (trigger CLI). Poll GET /v1/runs/:id for the result.' })
  @ApiAcceptedResponse({ type: RunCreatedDto })
  start(
    @CurrentApiKey() apiKey: ApiKeyContext,
    @Param('suiteId') suiteId: string,
    @Body() dto: CreateRunDto,
  ): Promise<RunCreatedResponse> {
    return this.runs.startForApiKey(apiKey, suiteId, dto);
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Run status, summary and results' })
  @ApiOkResponse({ type: V1RunDto })
  get(@CurrentApiKey() apiKey: ApiKeyContext, @Param('id') id: string): Promise<V1RunResponse> {
    return this.runs.getForApiKey(apiKey, id);
  }
}

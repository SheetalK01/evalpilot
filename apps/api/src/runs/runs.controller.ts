import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type {
  Paginated,
  RunCreatedResponse,
  RunDiffResponse,
  RunListItemResponse,
  RunResponse,
  TestResultResponse,
} from '@evalpilot/shared';
import { CurrentUser, SessionAuth } from '../common/decorators/auth.decorators';
import { PaginationQueryDto } from '../projects/projects.dto';
import type { AuthUser } from '../types/auth';
import { CreateRunDto, RunCreatedDto, RunDiffDto, RunDto, RunPageDto, TestResultDto } from './runs.dto';
import { RunsService } from './runs.service';

@ApiTags('Runs')
@SessionAuth()
@ApiNotFoundResponse({ description: 'Not found, or owned by another user' })
@Controller()
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Post('suites/:suiteId/runs')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Start a run. Returns 202 at once; results stream over WebSocket (room run:<id>).',
  })
  @ApiAcceptedResponse({ type: RunCreatedDto })
  start(
    @CurrentUser() user: AuthUser,
    @Param('suiteId') suiteId: string,
    @Body() dto: CreateRunDto,
  ): Promise<RunCreatedResponse> {
    return this.runs.startForOwner(user.id, suiteId, dto);
  }

  @Get('suites/:suiteId/runs')
  @ApiOperation({ summary: 'Runs of a suite, newest first, each with its status strip' })
  @ApiOkResponse({ type: RunPageDto })
  list(
    @CurrentUser() user: AuthUser,
    @Param('suiteId') suiteId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<RunListItemResponse>> {
    return this.runs.listForSuite(user.id, suiteId, query);
  }

  @Get('runs/:id')
  @ApiOkResponse({ type: RunDto })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<RunResponse> {
    return this.runs.get(user.id, id);
  }

  @Get('runs/:id/results')
  @ApiOperation({ summary: 'Results in suite order' })
  @ApiOkResponse({ type: [TestResultDto] })
  results(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<TestResultResponse[]> {
    return this.runs.results(user.id, id);
  }

  @Post('runs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a queued or running run (a running one stops before its next case)' })
  @ApiOkResponse({ type: RunDto })
  @ApiConflictResponse({ description: 'The run has already finished' })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<RunResponse> {
    return this.runs.cancel(user.id, id);
  }

  @Get('runs/:id/compare/:otherId')
  @ApiOperation({ summary: 'Diff of case statuses: `id` is the newer run, `otherId` the baseline' })
  @ApiOkResponse({ type: RunDiffDto })
  compare(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('otherId') otherId: string,
  ): Promise<RunDiffResponse> {
    return this.runs.compare(user.id, id, otherId);
  }
}

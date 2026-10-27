import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type {
  AttackResponse,
  Paginated,
  RedteamCreatedResponse,
  RedteamReportResponse,
  RedteamRunResponse,
} from '@evalpilot/shared';
import { CurrentUser, SessionAuth } from '../common/decorators/auth.decorators';
import { PaginationQueryDto } from '../projects/projects.dto';
import type { AuthUser } from '../types/auth';
import {
  AttackDto,
  RedteamCreatedDto,
  RedteamReportDto,
  RedteamRunPageDto,
  StartRedteamDto,
} from './redteam.dto';
import { RedteamService } from './redteam.service';

@ApiTags('Red-team')
@SessionAuth()
@ApiNotFoundResponse({ description: 'Not found, or owned by another user' })
@Controller()
export class RedteamController {
  constructor(private readonly redteam: RedteamService) {}

  @Get('attacks')
  @ApiOperation({ summary: 'The attack library' })
  @ApiOkResponse({ type: [AttackDto] })
  attacks(): Promise<AttackResponse[]> {
    return this.redteam.attacks();
  }

  @Post('targets/:targetId/redteam')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Start a red-team run against a target. Findings stream over WebSocket (room redteam:<id>).',
  })
  @ApiAcceptedResponse({ type: RedteamCreatedDto })
  start(
    @CurrentUser() user: AuthUser,
    @Param('targetId') targetId: string,
    @Body() dto: StartRedteamDto,
  ): Promise<RedteamCreatedResponse> {
    return this.redteam.start(user.id, targetId, dto);
  }

  @Get('projects/:projectId/redteam-runs')
  @ApiOkResponse({ type: RedteamRunPageDto })
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<RedteamRunResponse>> {
    return this.redteam.list(user.id, projectId, query);
  }

  @Get('redteam-runs/:id')
  @ApiOperation({ summary: 'Risk report: score, category breakdown and findings' })
  @ApiOkResponse({ type: RedteamReportDto })
  report(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<RedteamReportResponse> {
    return this.redteam.report(user.id, id);
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type DashboardResponse, dashboardSchema } from '@evalpilot/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, SessionAuth } from '../common/decorators/auth.decorators';
import type { AuthUser } from '../types/auth';
import { DashboardService } from './dashboard.service';

class DashboardDto extends createZodDto(dashboardSchema) {}

@ApiTags('Dashboard')
@SessionAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Counts, pass-rate trend, latest red-team score, cost/latency trend and recent runs',
  })
  @ApiOkResponse({ type: DashboardDto })
  get(@CurrentUser() user: AuthUser): Promise<DashboardResponse> {
    return this.dashboard.get(user.id);
  }
}

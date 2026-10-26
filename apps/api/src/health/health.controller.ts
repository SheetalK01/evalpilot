import { Controller, Get, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { healthSchema, type HealthResponse } from '@evalpilot/shared';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { Public } from '../common/decorators/auth.decorators';
import { HealthService } from './health.service';

class HealthDto extends createZodDto(healthSchema) {}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness of the API and its dependencies (DB, Redis, worker)' })
  @ApiOkResponse({ type: HealthDto })
  @ApiServiceUnavailableResponse({ type: HealthDto, description: 'Database or Redis is down' })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const result = await this.health.check();
    res.status(result.status === 'ok' ? 200 : 503);
    return result;
  }
}

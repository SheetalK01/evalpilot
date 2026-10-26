import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { type CreateTargetInput, createTargetSchema, type TargetResponse } from '@evalpilot/shared';
import { ZodValidationPipe } from 'nestjs-zod';
import { CurrentUser, SessionAuth } from '../common/decorators/auth.decorators';
import type { AuthUser } from '../types/auth';
import { createTargetBody, TargetDto, UpdateTargetDto } from './targets.dto';
import { TargetsService } from './targets.service';

@ApiTags('Targets')
@SessionAuth()
@ApiNotFoundResponse({ description: 'Not found, or owned by another user' })
@Controller()
export class TargetsController {
  constructor(private readonly targets: TargetsService) {}

  @Get('projects/:projectId/targets')
  @ApiOkResponse({ type: [TargetDto] })
  list(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string): Promise<TargetResponse[]> {
    return this.targets.list(user.id, projectId);
  }

  @Post('projects/:projectId/targets')
  @ApiBody(createTargetBody)
  @ApiCreatedResponse({ type: TargetDto })
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createTargetSchema)) dto: CreateTargetInput,
  ): Promise<TargetResponse> {
    return this.targets.create(user.id, projectId, dto);
  }

  @Get('targets/:id')
  @ApiOkResponse({ type: TargetDto })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<TargetResponse> {
    return this.targets.get(user.id, id);
  }

  @Patch('targets/:id')
  @ApiOkResponse({ type: TargetDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTargetDto,
  ): Promise<TargetResponse> {
    return this.targets.update(user.id, id, dto);
  }

  @Delete('targets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.targets.remove(user.id, id);
  }
}

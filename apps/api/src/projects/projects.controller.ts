import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Paginated, ProjectResponse } from '@evalpilot/shared';
import { CurrentUser, SessionAuth } from '../common/decorators/auth.decorators';
import type { AuthUser } from '../types/auth';
import {
  CreateProjectDto,
  PaginationQueryDto,
  ProjectDto,
  ProjectPageDto,
  UpdateProjectDto,
} from './projects.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@SessionAuth()
@ApiNotFoundResponse({ description: 'Not found, or owned by another user' })
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiOkResponse({ type: ProjectPageDto })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<ProjectResponse>> {
    return this.projects.list(user.id, query);
  }

  @Post()
  @ApiCreatedResponse({ type: ProjectDto })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto): Promise<ProjectResponse> {
    return this.projects.create(user.id, dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: ProjectDto })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ProjectResponse> {
    return this.projects.get(user.id, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ProjectDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponse> {
    return this.projects.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.projects.remove(user.id, id);
  }
}

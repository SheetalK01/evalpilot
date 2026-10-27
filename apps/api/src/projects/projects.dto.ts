import {
  createProjectSchema,
  paginatedSchema,
  paginationQuerySchema,
  projectSchema,
  updateProjectSchema,
} from '@evalpilot/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateProjectDto extends createZodDto(createProjectSchema) {}
export class UpdateProjectDto extends createZodDto(updateProjectSchema) {}
export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}
export class ProjectDto extends createZodDto(projectSchema) {}
export class ProjectPageDto extends createZodDto(paginatedSchema(projectSchema)) {}

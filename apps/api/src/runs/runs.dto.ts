import {
  createRunSchema,
  paginatedSchema,
  runCreatedSchema,
  runDiffSchema,
  runListItemSchema,
  runSchema,
  testResultSchema,
} from '@evalpilot/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateRunDto extends createZodDto(createRunSchema) {}
export class RunCreatedDto extends createZodDto(runCreatedSchema) {}
export class RunDto extends createZodDto(runSchema) {}
export class RunPageDto extends createZodDto(paginatedSchema(runListItemSchema)) {}
export class TestResultDto extends createZodDto(testResultSchema) {}
export class RunDiffDto extends createZodDto(runDiffSchema) {}

import {
  createSuiteSchema,
  csvImportResultSchema,
  paginatedSchema,
  suiteSchema,
  updateSuiteSchema,
} from '@evalpilot/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateSuiteDto extends createZodDto(createSuiteSchema) {}
export class UpdateSuiteDto extends createZodDto(updateSuiteSchema) {}
export class SuiteDto extends createZodDto(suiteSchema) {}
export class SuitePageDto extends createZodDto(paginatedSchema(suiteSchema)) {}
export class CsvImportResultDto extends createZodDto(csvImportResultSchema) {}

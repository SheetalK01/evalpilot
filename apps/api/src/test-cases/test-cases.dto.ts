import {
  createTestCaseSchema,
  reorderCasesSchema,
  testCaseSchema,
  updateTestCaseSchema,
} from '@evalpilot/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateTestCaseDto extends createZodDto(createTestCaseSchema) {}
export class UpdateTestCaseDto extends createZodDto(updateTestCaseSchema) {}
export class ReorderCasesDto extends createZodDto(reorderCasesSchema) {}
export class TestCaseDto extends createZodDto(testCaseSchema) {}

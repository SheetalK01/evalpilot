import {
  attackSchema,
  paginatedSchema,
  redteamCreatedSchema,
  redteamReportSchema,
  redteamRunSchema,
  startRedteamSchema,
} from '@evalpilot/shared';
import { createZodDto } from 'nestjs-zod';

export class AttackDto extends createZodDto(attackSchema) {}
export class StartRedteamDto extends createZodDto(startRedteamSchema) {}
export class RedteamCreatedDto extends createZodDto(redteamCreatedSchema) {}
export class RedteamRunPageDto extends createZodDto(paginatedSchema(redteamRunSchema)) {}
export class RedteamReportDto extends createZodDto(redteamReportSchema) {}

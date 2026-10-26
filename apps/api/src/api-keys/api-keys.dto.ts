import { apiKeySchema, createApiKeySchema, createdApiKeySchema } from '@evalpilot/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateApiKeyDto extends createZodDto(createApiKeySchema) {}
export class ApiKeyDto extends createZodDto(apiKeySchema) {}
export class CreatedApiKeyDto extends createZodDto(createdApiKeySchema) {}

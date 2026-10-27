import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { ApiKeyResponse, CreatedApiKeyResponse } from '@evalpilot/shared';
import { CurrentUser, SessionAuth } from '../common/decorators/auth.decorators';
import type { AuthUser } from '../types/auth';
import { ApiKeyDto, CreateApiKeyDto, CreatedApiKeyDto } from './api-keys.dto';
import { ApiKeysService } from './api-keys.service';

@ApiTags('API keys')
@SessionAuth()
@ApiNotFoundResponse({ description: 'Not found, or owned by another user' })
@Controller()
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get('projects/:projectId/api-keys')
  @ApiOperation({ summary: 'List keys (prefix only, never the full key)' })
  @ApiOkResponse({ type: [ApiKeyDto] })
  list(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string): Promise<ApiKeyResponse[]> {
    return this.apiKeys.list(user.id, projectId);
  }

  @Post('projects/:projectId/api-keys')
  @ApiOperation({ summary: 'Create a key. The full key is in this response only.' })
  @ApiCreatedResponse({ type: CreatedApiKeyDto })
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateApiKeyDto,
  ): Promise<CreatedApiKeyResponse> {
    return this.apiKeys.create(user.id, projectId, dto);
  }

  @Delete('api-keys/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a key' })
  @ApiNoContentResponse()
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.apiKeys.revoke(user.id, id);
  }
}

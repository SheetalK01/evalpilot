import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiKeyGuard } from '../guards/api-key.guard';
import type { ApiKeyContext, AuthUser } from '../../types/auth';

export const IS_PUBLIC = 'evalpilot:isPublic';
export const IS_API_KEY_ROUTE = 'evalpilot:isApiKeyRoute';

/** No session required. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Machine route: authenticated with a project API key (`Authorization: Bearer ep_live_…`), not a session. */
export const ApiKeyAuth = () =>
  applyDecorators(SetMetadata(IS_API_KEY_ROUTE, true), UseGuards(ApiKeyGuard), ApiBearerAuth('apiKey'));

/** Session route (the default). Only adds the Swagger security requirement. */
export const SessionAuth = () => ApiCookieAuth('session');

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<Request>().user;
  if (!user) throw new UnauthorizedException();
  return user;
});

export const CurrentApiKey = createParamDecorator((_data: unknown, ctx: ExecutionContext): ApiKeyContext => {
  const apiKey = ctx.switchToHttp().getRequest<Request>().apiKey;
  if (!apiKey) throw new UnauthorizedException();
  return apiKey;
});

import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { InjectConfig, type AppConfig } from '@evalpilot/server-core';
import { IS_API_KEY_ROUTE } from '../decorators/auth.decorators';
import { bearerToken } from './api-key.guard';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function requestOrigin(req: Request): string | null {
  const origin = req.headers.origin;
  if (origin) return origin;
  const referer = req.headers.referer;
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF protection for cookie-authenticated requests: on top of SameSite=Lax cookies, every
 * state-changing request must come from an allowed origin. API-key (Bearer) requests carry no
 * cookies and cannot be forged cross-site, so they are exempt.
 */
@Injectable()
export class CsrfOriginGuard implements CanActivate {
  constructor(
    @InjectConfig() private readonly config: AppConfig,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // WebSockets are protected by the origin check at the handshake (RealtimeIoAdapter).
    if (context.getType() !== 'http') return true;
    // Machine routes only accept an API key, never cookies, so there is nothing to forge.
    if (
      this.reflector.getAllAndOverride<boolean>(IS_API_KEY_ROUTE, [context.getHandler(), context.getClass()])
    )
      return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method) || bearerToken(req)) return true;
    const origin = requestOrigin(req);
    if (!origin) throw new ForbiddenException('Missing Origin header');
    if (!this.config.allowedOrigins.includes(origin)) throw new ForbiddenException('Origin not allowed');
    return true;
  }
}

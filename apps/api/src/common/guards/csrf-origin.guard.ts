import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { InjectConfig } from '../../config/config.module';
import type { AppConfig } from '../../config/env';
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
  constructor(@InjectConfig() private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method) || bearerToken(req)) return true;
    const origin = requestOrigin(req);
    if (!origin) throw new ForbiddenException('Missing Origin header');
    if (!this.config.allowedOrigins.includes(origin)) throw new ForbiddenException('Origin not allowed');
    return true;
  }
}

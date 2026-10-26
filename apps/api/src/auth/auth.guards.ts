import { type ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { loginSchema } from '@evalpilot/shared';
import type { Request } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { InjectConfig, type AppConfig } from '@evalpilot/server-core';

/** Validates the login body (400 on bad input) before Passport checks the credentials (401). */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  override canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    req.body = parsed.data;
    return super.canActivate(context);
  }
}

@Injectable()
export class GithubAuthGuard extends AuthGuard('github') {
  constructor(@InjectConfig() private readonly config: AppConfig) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    if (!this.config.github) throw new NotFoundException('GitHub sign-in is not configured');
    return super.canActivate(context);
  }
}

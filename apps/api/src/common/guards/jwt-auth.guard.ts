import { type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_API_KEY_ROUTE, IS_PUBLIC } from '../decorators/auth.decorators';

/** Global guard: every route needs a valid session cookie unless marked @Public() or @ApiKeyAuth(). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(IS_API_KEY_ROUTE, targets)) return true;
    return super.canActivate(context);
  }

  override handleRequest<TUser>(error: unknown, user: TUser | false): TUser {
    if (error || !user) throw new UnauthorizedException('Sign in to continue');
    return user;
  }
}

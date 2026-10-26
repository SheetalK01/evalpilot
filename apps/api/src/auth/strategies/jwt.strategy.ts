import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { SESSION_COOKIE } from '@evalpilot/shared';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectConfig } from '../../config/config.module';
import type { AppConfig } from '../../config/env';
import type { AuthUser } from '../../types/auth';
import { UsersService } from '../../users/users.service';
import type { JwtPayload } from '../auth.service';

export function cookieExtractor(req: Request): string | null {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const token = cookies?.[SESSION_COOKIE];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectConfig() config: AppConfig,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      secretOrKey: config.jwt.secret,
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }

  /** Runs after the signature and expiry are verified. Rejects tokens of deleted users. */
  async validate(payload: JwtPayload): Promise<AuthUser | false> {
    const user = await this.users.findById(payload.sub);
    return user ? { id: user.id, email: user.email, name: user.name } : false;
  }
}

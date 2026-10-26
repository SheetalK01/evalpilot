import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import type { AuthUser } from '../../types/auth';
import { AuthService } from '../auth.service';

/** Body shape is validated by LocalAuthGuard before this runs. */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  async validate(email: string, password: string): Promise<AuthUser> {
    const user = await this.auth.validateCredentials(email, password);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    return { id: user.id, email: user.email, name: user.name };
  }
}

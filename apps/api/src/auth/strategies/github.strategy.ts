import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-github2';
import type { AppConfig } from '@evalpilot/server-core';
import type { AuthUser } from '../../types/auth';
import { AuthService } from '../auth.service';

/** Registered only when GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are set (see AuthModule). */
@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    github: NonNullable<AppConfig['github']>,
    private readonly auth: AuthService,
  ) {
    super({
      clientID: github.clientId,
      clientSecret: github.clientSecret,
      callbackURL: github.callbackUrl,
      scope: ['user:email'],
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: Profile): Promise<AuthUser> {
    const user = await this.auth.findOrCreateGithubUser({
      githubId: profile.id,
      email: profile.emails?.[0]?.value ?? null,
      name: [profile.displayName, profile.username].find((value) => value?.trim()) ?? 'GitHub user',
      avatarUrl: profile.photos?.[0]?.value ?? null,
    });
    return { id: user.id, email: user.email, name: user.name };
  }
}

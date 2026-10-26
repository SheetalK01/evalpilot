import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GithubStrategy } from './strategies/github.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.jwt.secret,
        signOptions: { expiresIn: config.jwt.ttlSeconds, algorithm: 'HS256' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    {
      // The GitHub strategy only exists when OAuth credentials are configured.
      provide: GithubStrategy,
      inject: [APP_CONFIG, AuthService],
      useFactory: (config: AppConfig, auth: AuthService) =>
        config.github ? new GithubStrategy(config.github, auth) : null,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CsrfOriginGuard } from './common/guards/csrf-origin.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppThrottlerGuard, throttlerOptions } from './common/guards/throttler';
import { pinoOptions } from './common/logger';
import { ConfigModule } from './config/config.module';
import { APP_CONFIG, type AppConfig } from './config/env';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { RedisModule } from './redis/redis.module';
import { SuitesModule } from './suites/suites.module';
import { TargetsModule } from './targets/targets.module';
import { TestCasesModule } from './test-cases/test-cases.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => pinoOptions(config),
    }),
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => throttlerOptions(config),
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    ProjectsModule,
    ApiKeysModule,
    TargetsModule,
    SuitesModule,
    TestCasesModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Guards run in this order: rate limit → CSRF origin check → session.
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfOriginGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { SecretBoxService } from '@evalpilot/server-core';
import { TargetsController } from './targets.controller';
import { TargetsService } from './targets.service';

@Module({
  controllers: [TargetsController],
  providers: [TargetsService, SecretBoxService],
  exports: [TargetsService],
})
export class TargetsModule {}

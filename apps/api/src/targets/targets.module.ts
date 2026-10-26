import { Module } from '@nestjs/common';
import { SecretBoxService } from '../common/crypto/secret-box';
import { TargetsController } from './targets.controller';
import { TargetsService } from './targets.service';

@Module({
  controllers: [TargetsController],
  providers: [TargetsService, SecretBoxService],
  exports: [TargetsService],
})
export class TargetsModule {}

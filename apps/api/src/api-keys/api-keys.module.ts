import { Global, Module } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';

/** Global so any module can protect machine routes with @ApiKeyAuth(). */
@Global()
@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyGuard],
  exports: [ApiKeysService, ApiKeyGuard],
})
export class ApiKeysModule {}

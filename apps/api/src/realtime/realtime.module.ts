import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { RealtimeAccessService } from './realtime-access.service';
import { RealtimeRelay } from './realtime-relay.service';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [AuthModule, UsersModule],
  providers: [RealtimeGateway, RealtimeAccessService, RealtimeRelay],
})
export class RealtimeModule {}

import { Module } from '@nestjs/common';
import { TargetsModule } from '../targets/targets.module';
import { RedteamController } from './redteam.controller';
import { RedteamService } from './redteam.service';

@Module({ imports: [TargetsModule], controllers: [RedteamController], providers: [RedteamService] })
export class RedteamModule {}

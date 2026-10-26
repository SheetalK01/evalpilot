import { Module } from '@nestjs/common';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { V1RunsController } from './v1-runs.controller';

@Module({ controllers: [RunsController, V1RunsController], providers: [RunsService], exports: [RunsService] })
export class RunsModule {}

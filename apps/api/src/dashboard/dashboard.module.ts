import { Module } from '@nestjs/common';
import { RunsModule } from '../runs/runs.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({ imports: [RunsModule], controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}

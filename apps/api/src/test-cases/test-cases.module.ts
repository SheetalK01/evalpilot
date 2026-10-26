import { Module } from '@nestjs/common';
import { SuitesModule } from '../suites/suites.module';
import { TestCasesController } from './test-cases.controller';
import { TestCasesService } from './test-cases.service';

@Module({ imports: [SuitesModule], controllers: [TestCasesController], providers: [TestCasesService] })
export class TestCasesModule {}

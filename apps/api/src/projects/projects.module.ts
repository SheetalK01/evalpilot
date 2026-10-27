import { Global, Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

/** Global so every project-scoped module can use `ProjectsService.assertOwned`. */
@Global()
@Module({ controllers: [ProjectsController], providers: [ProjectsService], exports: [ProjectsService] })
export class ProjectsModule {}

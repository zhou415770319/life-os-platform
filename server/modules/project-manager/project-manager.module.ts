import { Module } from '@nestjs/common';
import { ProjectManagerController } from './project-manager.controller';
import { ProjectManagerService } from './project-manager.service';

@Module({
  controllers: [ProjectManagerController],
  providers: [ProjectManagerService],
  exports: [ProjectManagerService],
})
export class ProjectManagerModule {}

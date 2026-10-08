import { Module } from '@nestjs/common';
import { ChildResourcesController } from './child-resources.controller';
import { ChildResourcesService } from './child-resources.service';

@Module({
  controllers: [ChildResourcesController],
  providers: [ChildResourcesService],
  exports: [ChildResourcesService],
})
export class ChildResourcesModule {}

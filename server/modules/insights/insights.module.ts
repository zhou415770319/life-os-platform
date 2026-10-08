import { Module } from '@nestjs/common';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { ChildResourcesModule } from '@server/modules/child-resources/child-resources.module';
import { RpaManagerModule } from '@server/modules/rpa-manager/rpa-manager.module';

@Module({
  imports: [ChildResourcesModule, RpaManagerModule],
  controllers: [InsightsController],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {}

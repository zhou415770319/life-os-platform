import { Module } from '@nestjs/common';
import { InsightsModule } from '@server/modules/insights/insights.module';
import { NotesModule } from '@server/modules/notes/notes.module';
import { LifeLogModule } from '@server/modules/life-log/life-log.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [InsightsModule, NotesModule, LifeLogModule],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}

import { Module } from '@nestjs/common';
import { ReviewBoardController } from './review-board.controller';
import { ReviewBoardService } from './review-board.service';

@Module({
  controllers: [ReviewBoardController],
  providers: [ReviewBoardService],
  exports: [ReviewBoardService],
})
export class ReviewBoardModule {}

import { Module } from '@nestjs/common';
import { LifeLogController } from './life-log.controller';
import { LifeLogService } from './life-log.service';

@Module({
  controllers: [LifeLogController],
  providers: [LifeLogService],
  exports: [LifeLogService],
})
export class LifeLogModule {}

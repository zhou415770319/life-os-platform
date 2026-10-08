import { Module } from '@nestjs/common';
import { TimeBlackholeController } from './time-blackhole.controller';
import { TimeBlackholeService } from './time-blackhole.service';

@Module({
  controllers: [TimeBlackholeController],
  providers: [TimeBlackholeService],
  exports: [TimeBlackholeService],
})
export class TimeBlackholeModule {}

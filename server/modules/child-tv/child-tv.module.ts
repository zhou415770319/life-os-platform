import { Module } from '@nestjs/common';
import { ChildTvController } from './child-tv.controller';
import { ChildTvService } from './child-tv.service';

@Module({
  controllers: [ChildTvController],
  providers: [ChildTvService],
  exports: [ChildTvService],
})
export class ChildTvModule {}

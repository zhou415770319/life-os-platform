import { Module } from '@nestjs/common';
import { XmPlayerController } from './xm-player.controller';
import { XmPlayerService } from './xm-player.service';

@Module({
  controllers: [XmPlayerController],
  providers: [XmPlayerService],
  exports: [XmPlayerService],
})
export class XmPlayerModule {}

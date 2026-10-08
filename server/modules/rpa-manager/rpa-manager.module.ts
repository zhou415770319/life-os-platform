import { Module } from '@nestjs/common';
import { RpaManagerController } from './rpa-manager.controller';
import { RpaManagerService } from './rpa-manager.service';

@Module({
  controllers: [RpaManagerController],
  providers: [RpaManagerService],
  exports: [RpaManagerService],
})
export class RpaManagerModule {}

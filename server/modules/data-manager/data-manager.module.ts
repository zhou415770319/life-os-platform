import { Module } from '@nestjs/common';
import { DataManagerController } from './data-manager.controller';
import { DataManagerService } from './data-manager.service';

@Module({
  controllers: [DataManagerController],
  providers: [DataManagerService],
})
export class DataManagerModule {}

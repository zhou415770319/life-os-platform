import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { TimeBlackholeService } from './time-blackhole.service';

@Controller('api/time-blackhole')
export class TimeBlackholeController {
  constructor(private readonly timeBlackholeService: TimeBlackholeService) {}

  @Get('records')
  getRecords(@Query('recordDate') recordDate?: string) {
    return this.timeBlackholeService.getRecords(recordDate);
  }

  @Get('stats')
  getStats() {
    return this.timeBlackholeService.getStats();
  }

  @Post('records')
  createRecord(
    @Body()
    dto: {
      category: string;
      note?: string;
      durationMinutes: number;
      recordDate?: string;
    },
  ) {
    return this.timeBlackholeService.createRecord(dto);
  }

  @Delete('records/:id')
  deleteRecord(@Param('id') id: string) {
    return this.timeBlackholeService.deleteRecord(id);
  }
}

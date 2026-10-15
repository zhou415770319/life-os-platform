import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { TimeBlackholeService } from './time-blackhole.service';

@NeedLogin()
@Controller('api/time-blackhole')
export class TimeBlackholeController {
  constructor(private readonly timeBlackholeService: TimeBlackholeService) {}

  @Get('records')
  getRecords(
    @Req() req: { userContext: { userId: string } },
    @Query('recordDate') recordDate?: string,
  ) {
    return this.timeBlackholeService.getRecords(req.userContext.userId, recordDate);
  }

  @Get('stats')
  getStats(@Req() req: { userContext: { userId: string } }) {
    return this.timeBlackholeService.getStats(req.userContext.userId);
  }

  @Post('records')
  createRecord(
    @Req() req: { userContext: { userId: string } },
    @Body()
    dto: {
      category: string;
      note?: string;
      durationMinutes: number;
      recordDate?: string;
    },
  ) {
    return this.timeBlackholeService.createRecord(dto, req.userContext.userId);
  }

  @Delete('records/:id')
  deleteRecord(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.timeBlackholeService.deleteRecord(id, req.userContext.userId);
  }
}

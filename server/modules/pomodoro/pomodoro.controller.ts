import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { PomodoroService } from './pomodoro.service';

@NeedLogin()
@Controller('api/pomodoro')
export class PomodoroController {
  constructor(private readonly pomodoroService: PomodoroService) {}

  @Get('records')
  getRecords(@Req() req: { userContext: { userId: string } }) {
    return this.pomodoroService.getRecords(req.userContext.userId);
  }

  @Get('stats')
  getStats(@Req() req: { userContext: { userId: string } }) {
    return this.pomodoroService.getStats(req.userContext.userId);
  }

  @Post('records')
  createRecord(
    @Req() req: { userContext: { userId: string } },
    @Body()
    dto: {
      taskName?: string;
      durationMinutes: number;
      completedAt: string;
      abandoned?: boolean;
    },
  ) {
    return this.pomodoroService.createRecord(dto, req.userContext.userId);
  }

  @Delete('records/:id')
  deleteRecord(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.pomodoroService.deleteRecord(id, req.userContext.userId);
  }
}

import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { PomodoroService } from './pomodoro.service';

@Controller('api/pomodoro')
export class PomodoroController {
  constructor(private readonly pomodoroService: PomodoroService) {}

  @Get('records')
  getRecords() {
    return this.pomodoroService.getRecords();
  }

  @Get('stats')
  getStats() {
    return this.pomodoroService.getStats();
  }

  @Post('records')
  createRecord(
    @Body()
    dto: {
      taskName?: string;
      durationMinutes: number;
      completedAt: string;
      abandoned?: boolean;
    },
  ) {
    return this.pomodoroService.createRecord(dto);
  }

  @Delete('records/:id')
  deleteRecord(@Param('id') id: string) {
    return this.pomodoroService.deleteRecord(id);
  }
}

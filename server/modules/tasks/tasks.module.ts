import { Module } from '@nestjs/common';
import { PomodoroModule } from '@server/modules/pomodoro/pomodoro.module';
import { LifeLogModule } from '@server/modules/life-log/life-log.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [PomodoroModule, LifeLogModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}

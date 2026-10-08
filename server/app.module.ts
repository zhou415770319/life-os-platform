import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Module } from '@nestjs/common';

import { LocalPlatformModule } from './platform-local/local.module';
import { LocalDatabaseModule } from './storage/local-database.module';
import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { ViewModule } from './modules/view/view.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GoalsModule } from './modules/goals/goals.module';
import { HabitsModule } from './modules/habits/habits.module';
import { NotesModule } from './modules/notes/notes.module';
import { PluginsModule } from './modules/plugins/plugins.module';
import { DataManagerModule } from './modules/data-manager/data-manager.module';
import { ChildResourcesModule } from './modules/child-resources/child-resources.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HealthModule } from './modules/health/health.module';
import { LifeLogModule } from './modules/life-log/life-log.module';
import { PomodoroModule } from './modules/pomodoro/pomodoro.module';
import { TimeBlackholeModule } from './modules/time-blackhole/time-blackhole.module';
import { AiSettingsModule } from './modules/ai-settings/ai-settings.module';
import { RpaManagerModule } from './modules/rpa-manager/rpa-manager.module';
import { InsightsModule } from './modules/insights/insights.module';
import { ReviewModule } from './modules/review/review.module';
import { ReviewBoardModule } from './modules/review-board/review-board.module';
import { ChildTvModule } from './modules/child-tv/child-tv.module';

@Module({
  imports: [
    // 本地模式平台模块（替代平台 PlatformModule，无需平台服务）
    LocalPlatformModule,
    // 本地 JSON 文件存储（后期可切换线上数据库）
    LocalDatabaseModule,
    // ====== @route-section: business-modules START ======
    DashboardModule,
    GoalsModule,
    HabitsModule,
    NotesModule,
    PluginsModule,
    DataManagerModule,
    ChildResourcesModule,
    TasksModule,
    FinanceModule,
    HealthModule,
    LifeLogModule,
    PomodoroModule,
    TimeBlackholeModule,
    AiSettingsModule,
    RpaManagerModule,
    InsightsModule,
    ReviewModule,
    ReviewBoardModule,
    ChildTvModule,
    // ====== @route-section: business-modules END ======

    // ⚠️ @route-order: last
    // ViewModule is the fallback route module, must be registered last.
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
        forbidUnknownValues: true,
      }),
    },
  ],
})
export class AppModule {}

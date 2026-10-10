import { Module, forwardRef } from '@nestjs/common';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';
import { LifeLogModule } from '@server/modules/life-log/life-log.module';
import { ChildResourcesModule } from '@server/modules/child-resources/child-resources.module';
import { GoalsModule } from '@server/modules/goals/goals.module';
import { HabitsModule } from '@server/modules/habits/habits.module';
import { NotesModule } from '@server/modules/notes/notes.module';
import { TasksModule } from '@server/modules/tasks/tasks.module';
import { FinanceModule } from '@server/modules/finance/finance.module';
import { HealthModule } from '@server/modules/health/health.module';
import { PomodoroModule } from '@server/modules/pomodoro/pomodoro.module';
import { TimeBlackholeModule } from '@server/modules/time-blackhole/time-blackhole.module';
import { RpaManagerModule } from '@server/modules/rpa-manager/rpa-manager.module';
import { InsightsModule } from '@server/modules/insights/insights.module';
import { ReviewModule } from '@server/modules/review/review.module';
import { ReviewBoardModule } from '@server/modules/review-board/review-board.module';
import { ChildTvModule } from '@server/modules/child-tv/child-tv.module';
import { PluginMethodRegistry } from './plugin-method.registry';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { AiChatService } from './ai-chat.service';
import { AiChatController } from './ai-chat.controller';
import { AiChatHistoryService } from './ai-chat-history.service';

@Module({
  imports: [
    LifeLogModule,
    ChildResourcesModule,
    GoalsModule,
    HabitsModule,
    NotesModule,
    TasksModule,
    FinanceModule,
    HealthModule,
    PomodoroModule,
    TimeBlackholeModule,
    RpaManagerModule,
    InsightsModule,
    ReviewModule,
    ReviewBoardModule,
    ChildTvModule,
  ],
  controllers: [PluginsController, AiChatController, MarketController],
  providers: [PluginsService, PluginMethodRegistry, AiChatService, AiChatHistoryService, MarketService],
  exports: [PluginsService, PluginMethodRegistry, MarketService],
})
export class PluginsModule {}

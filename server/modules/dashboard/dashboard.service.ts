import { Inject, Injectable, Logger } from '@nestjs/common';
import { LOCAL_DATABASE } from '@server/storage/local-database.module';
import type { LocalDatabase } from '@server/storage/local-database';
import { count, eq, and, gte, lte } from '@server/storage/drizzle-compat';
import { lifeGoals, lifeHabits, lifeHabitRecords, lifeNotes } from '@server/database/schema';
import type { DashboardStats } from '@shared/api.interface';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @Inject(LOCAL_DATABASE) private readonly db: LocalDatabase,
  ) {}

  async getStats(): Promise<DashboardStats> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const todayStartIso = todayStart.toISOString();
    const todayEndIso = todayEnd.toISOString();

    const [goalsCount] = await this.db.select({ count: count() }).from(lifeGoals);
    const [goalsActive] = await this.db
      .select({ count: count() })
      .from(lifeGoals)
      .where(eq(lifeGoals.status, 'active'));
    const [habitsCount] = await this.db.select({ count: count() }).from(lifeHabits);
    const [todayCompleted] = await this.db
      .select({ count: count() })
      .from(lifeHabitRecords)
      .where(eq(lifeHabitRecords.recordDate, todayStr));
    const [notesCount] = await this.db.select({ count: count() }).from(lifeNotes);
    const [notesToday] = await this.db
      .select({ count: count() })
      .from(lifeNotes)
      .where(
        and(
          gte(lifeNotes.createdAt, todayStartIso),
          lte(lifeNotes.createdAt, todayEndIso),
        ),
      );

    const goalsTotal = Number(goalsCount?.count ?? 0);
    const goalsActiveNum = Number(goalsActive?.count ?? 0);
    const habitsTotal = Number(habitsCount?.count ?? 0);
    const todayCompletedNum = Number(todayCompleted?.count ?? 0);
    const notesTotal = Number(notesCount?.count ?? 0);
    const todayNotes = Number(notesToday?.count ?? 0);

    const todayProgress =
      habitsTotal > 0 ? Math.round((todayCompletedNum / habitsTotal) * 100) : 0;

    this.logger.log('Dashboard stats retrieved');

    return {
      goals: {
        total: goalsTotal,
        active: goalsActiveNum,
      },
      habits: {
        total: habitsTotal,
        todayCompleted: todayCompletedNum,
        todayProgress,
      },
      notes: {
        total: notesTotal,
        todayCount: todayNotes,
      },
    };
  }
}

import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { LOCAL_DATABASE } from '@server/storage/local-database.module';
import type { LocalDatabase } from '@server/storage/local-database';
import { eq, and, desc, count, gte } from '@server/storage/drizzle-compat';
import type {
  LifeHabit,
  HabitRecord,
  CreateHabitDto,
  EnergyRecord,
  CreateEnergyDto,
} from '@shared/api.interface';
import { lifeHabits, lifeHabitRecords, lifeEnergyRecords } from '@server/database/schema';

@Injectable()
export class HabitsService {
  private readonly logger = new Logger(HabitsService.name);

  constructor(
    @Inject(LOCAL_DATABASE) private readonly db: LocalDatabase,
  ) {}

  private toHabit(row: typeof lifeHabits.$inferSelect): LifeHabit {
    return {
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      frequency: row.frequency,
      streakCount: row.streakCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toHabitRecord(row: typeof lifeHabitRecords.$inferSelect): HabitRecord {
    return {
      id: row.id,
      habitId: row.habitId,
      recordDate: row.recordDate,
      completed: row.completed,
    };
  }

  private toEnergyRecord(row: typeof lifeEnergyRecords.$inferSelect): EnergyRecord {
    return {
      id: row.id,
      recordDate: row.recordDate,
      energyLevel: row.energyLevel,
      focusLevel: row.focusLevel,
      mood: row.mood,
      note: row.note,
    };
  }

  // ===== 习惯（按用户隔离） =====

  async findAllHabits(userId: string, page?: number, pageSize?: number): Promise<{ items: LifeHabit[]; total: number }> {
    const size = pageSize ?? 0;
    const pageNum = page ?? 1;

    const query = this.db
      .select()
      .from(lifeHabits)
      .where(eq(lifeHabits.createdBy, userId))
      .orderBy(desc(lifeHabits.createdAt));
    const paginatedQuery = size > 0
      ? query.limit(size).offset((pageNum - 1) * size)
      : query;

    const [rows, totalResult] = await Promise.all([
      paginatedQuery,
      this.db.select({ count: count() }).from(lifeHabits).where(eq(lifeHabits.createdBy, userId)),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const items: LifeHabit[] = rows.map((row) => this.toHabit(row));

    this.logger.log(`Found ${items.length} habits`);
    return { items, total };
  }

  async createHabit(dto: CreateHabitDto, userId: string): Promise<LifeHabit> {
    const rows = await this.db
      .insert(lifeHabits)
      .values({
        name: dto.name,
        icon: dto.icon,
        color: dto.color,
        frequency: dto.frequency ?? 'daily',
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    this.logger.log(`Habit created: ${rows[0].id}`);
    return this.toHabit(rows[0]);
  }

  async deleteHabit(id: string, userId: string): Promise<void> {
    const rows = await this.db
      .delete(lifeHabits)
      .where(and(eq(lifeHabits.id, id), eq(lifeHabits.createdBy, userId)))
      .returning({ id: lifeHabits.id });
    if (rows.length === 0) {
      throw new NotFoundException('习惯不存在');
    }
    this.logger.log(`Habit deleted: ${id}`);
  }

  async updateHabit(id: string, dto: Partial<CreateHabitDto>, userId: string): Promise<LifeHabit> {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.icon !== undefined) patch.icon = dto.icon;
    if (dto.color !== undefined) patch.color = dto.color;
    if (dto.frequency !== undefined) patch.frequency = dto.frequency;
    patch.updatedBy = userId;
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('没有需要更新的字段');
    }
    const rows = await this.db
      .update(lifeHabits)
      .set(patch)
      .where(and(eq(lifeHabits.id, id), eq(lifeHabits.createdBy, userId)))
      .returning();
    if (rows.length === 0) {
      throw new NotFoundException('习惯不存在');
    }
    this.logger.log(`Habit updated: ${id}`);
    return this.toHabit(rows[0]);
  }

  /** 打卡记录：按用户隔离（habit 属于该用户，其记录也属于该用户） */
  async getRecordsByDate(userId: string, date: string): Promise<{ items: HabitRecord[]; total: number }> {
    if (!date) {
      throw new BadRequestException('日期参数不能为空');
    }

    const [rows, totalResult] = await Promise.all([
      this.db
        .select()
        .from(lifeHabitRecords)
        .where(and(eq(lifeHabitRecords.recordDate, date), eq(lifeHabitRecords.createdBy, userId))),
      this.db
        .select({ count: count() })
        .from(lifeHabitRecords)
        .where(and(eq(lifeHabitRecords.recordDate, date), eq(lifeHabitRecords.createdBy, userId))),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const items: HabitRecord[] = rows.map((row) => this.toHabitRecord(row));

    this.logger.log(`Found ${items.length} habit records for ${date}`);
    return { items, total };
  }

  private getYesterdayStr(dateStr: string): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  private async updateStreakCount(habitId: string, streak: number): Promise<void> {
    await this.db
      .update(lifeHabits)
      .set({ streakCount: streak, updatedAt: new Date() })
      .where(eq(lifeHabits.id, habitId));
  }

  async toggleRecord(habitId: string, date: string, userId: string): Promise<HabitRecord> {
    if (!habitId || !date) {
      throw new BadRequestException('habitId 和 date 不能为空');
    }

    // 习惯归属校验：只能操作自己的习惯
    const habitRows = await this.db
      .select({ id: lifeHabits.id })
      .from(lifeHabits)
      .where(and(eq(lifeHabits.id, habitId), eq(lifeHabits.createdBy, userId)));
    if (habitRows.length === 0) {
      throw new NotFoundException('习惯不存在');
    }

    const existing = await this.db
      .select()
      .from(lifeHabitRecords)
      .where(
        and(
          eq(lifeHabitRecords.habitId, habitId),
          eq(lifeHabitRecords.recordDate, date),
          eq(lifeHabitRecords.createdBy, userId),
        ),
      );

    if (existing.length > 0) {
      await this.db
        .delete(lifeHabitRecords)
        .where(and(eq(lifeHabitRecords.id, existing[0].id), eq(lifeHabitRecords.createdBy, userId)));
      // 取消打卡：简化处理，streak 重置为 0
      await this.updateStreakCount(habitId, 0);
      this.logger.log(`Habit record unchecked: ${habitId} on ${date}`);
      return this.toHabitRecord({ ...existing[0], completed: false });
    }

    const rows = await this.db
      .insert(lifeHabitRecords)
      .values({
        habitId,
        recordDate: date,
        completed: true,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    // 打卡成功：计算连续天数
    const yesterdayStr = this.getYesterdayStr(date);
    const yesterdayRecords = await this.db
      .select()
      .from(lifeHabitRecords)
      .where(
        and(
          eq(lifeHabitRecords.habitId, habitId),
          eq(lifeHabitRecords.recordDate, yesterdayStr),
          eq(lifeHabitRecords.createdBy, userId),
        ),
      );

    const currentStreak = habitRows[0]?.id ? (await this.db
      .select({ streakCount: lifeHabits.streakCount })
      .from(lifeHabits)
      .where(eq(lifeHabits.id, habitId)))[0]?.streakCount ?? 0 : 0;
    const newStreak = yesterdayRecords.length > 0 ? currentStreak + 1 : 1;
    await this.updateStreakCount(habitId, newStreak);

    this.logger.log(`Habit record checked: ${habitId} on ${date}, streak=${newStreak}`);
    return this.toHabitRecord(rows[0]);
  }

  // ===== 能量记录（按用户隔离） =====

  async getEnergyRecords(userId: string): Promise<{ items: EnergyRecord[]; total: number }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const [rows, totalResult] = await Promise.all([
      this.db
        .select()
        .from(lifeEnergyRecords)
        .where(and(gte(lifeEnergyRecords.recordDate, thirtyDaysAgoStr), eq(lifeEnergyRecords.createdBy, userId)))
        .orderBy(desc(lifeEnergyRecords.recordDate)),
      this.db
        .select({ count: count() })
        .from(lifeEnergyRecords)
        .where(and(gte(lifeEnergyRecords.recordDate, thirtyDaysAgoStr), eq(lifeEnergyRecords.createdBy, userId))),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const items: EnergyRecord[] = rows.map((row) => this.toEnergyRecord(row));

    this.logger.log(`Found ${items.length} energy records`);
    return { items, total };
  }

  async createEnergyRecord(dto: CreateEnergyDto, userId: string): Promise<EnergyRecord> {
    const rows = await this.db
      .insert(lifeEnergyRecords)
      .values({
        recordDate: dto.recordDate,
        energyLevel: dto.energyLevel,
        focusLevel: dto.focusLevel,
        mood: dto.mood,
        note: dto.note,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    this.logger.log(`Energy record created: ${rows[0].id}`);
    return this.toEnergyRecord(rows[0]);
  }
}

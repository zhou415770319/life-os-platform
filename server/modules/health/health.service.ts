import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { LOCAL_DATABASE } from '@server/storage/local-database.module';
import type { LocalDatabase } from '@server/storage/local-database';
import { eq, ne, like, ilike, and, or, desc, asc, count, gte, lte, gt, lt, sql } from '@server/storage/drizzle-compat';
import { lifeHealthRecords } from '@server/database/schema';
import type {
  HealthRecord,
  HealthRecordType,
  HealthMetrics,
  HealthSummary,
  HealthTrendPoint,
  ListResponse,
} from '@shared/api.interface';

interface CreateHealthRecordDto {
  recordType: HealthRecordType;
  recordDate: string;
  metrics?: HealthMetrics;
  note?: string;
}

interface UpdateHealthRecordDto {
  recordType?: HealthRecordType;
  recordDate?: string;
  metrics?: HealthMetrics;
  note?: string;
}

interface ListQuery {
  recordType?: HealthRecordType;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(LOCAL_DATABASE) private readonly db: LocalDatabase,
  ) {}

  private mapRowToRecord(
    row: typeof lifeHealthRecords.$inferSelect,
  ): HealthRecord {
    return {
      id: row.id,
      recordType: row.recordType as HealthRecordType,
      recordDate: row.recordDate,
      metrics: (row.metrics ?? {}) as HealthMetrics,
      note: row.note ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findRecords(query: ListQuery): Promise<ListResponse<HealthRecord>> {
    const { recordType, startDate, endDate, page, pageSize } = query;

    const conditions = [];
    if (recordType) {
      conditions.push(eq(lifeHealthRecords.recordType, recordType));
    }
    if (startDate) {
      conditions.push(gte(lifeHealthRecords.recordDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(lifeHealthRecords.recordDate, endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(lifeHealthRecords)
        .where(whereClause),
      this.db
        .select()
        .from(lifeHealthRecords)
        .where(whereClause)
        .orderBy(desc(lifeHealthRecords.recordDate), desc(lifeHealthRecords.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items: HealthRecord[] = rows.map((row) => this.mapRowToRecord(row));

    return { items, total };
  }

  async findOne(id: string): Promise<HealthRecord> {
    const rows = await this.db
      .select()
      .from(lifeHealthRecords)
      .where(eq(lifeHealthRecords.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('记录不存在');
    }

    return this.mapRowToRecord(rows[0]);
  }

  async create(dto: CreateHealthRecordDto, userId: string): Promise<HealthRecord> {
    const [row] = await this.db
      .insert(lifeHealthRecords)
      .values({
        recordType: dto.recordType,
        recordDate: dto.recordDate,
        metrics: (dto.metrics ?? {}) as Record<string, unknown>,
        note: dto.note,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    this.logger.log(`Health record created: ${row.id} (${row.recordType})`);
    return this.mapRowToRecord(row);
  }

  async update(
    id: string,
    dto: UpdateHealthRecordDto,
    userId: string,
  ): Promise<HealthRecord> {
    const patch: Partial<typeof lifeHealthRecords.$inferInsert> = {};
    if (dto.recordType !== undefined) patch.recordType = dto.recordType;
    if (dto.recordDate !== undefined) patch.recordDate = dto.recordDate;
    if (dto.metrics !== undefined) {
      patch.metrics = dto.metrics as Record<string, unknown>;
    }
    if (dto.note !== undefined) patch.note = dto.note;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();
    patch.updatedBy = userId;

    const [row] = await this.db
      .update(lifeHealthRecords)
      .set(patch)
      .where(eq(lifeHealthRecords.id, id))
      .returning();

    if (!row) {
      throw new NotFoundException('记录不存在');
    }

    this.logger.log(`Health record updated: ${id}`);
    return this.mapRowToRecord(row);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const deleted = await this.db
      .delete(lifeHealthRecords)
      .where(eq(lifeHealthRecords.id, id))
      .returning({ id: lifeHealthRecords.id });

    if (deleted.length === 0) {
      throw new NotFoundException('记录不存在');
    }

    this.logger.log(`Health record deleted: ${id}`);
    return { success: true };
  }

  async getSummary(days: number): Promise<HealthSummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate date range for trend (last `days` days, inclusive of today)
    const endDate = new Date(today);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (days - 1));

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Calculate Monday of current week (Mon-Sun week)
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekMonday = new Date(today);
    weekMonday.setDate(weekMonday.getDate() + diffToMonday);
    const weekMondayStr = weekMonday.toISOString().split('T')[0];

    // Sunday of current week (exclusive upper bound)
    const weekSunday = new Date(weekMonday);
    weekSunday.setDate(weekSunday.getDate() + 7);
    const weekSundayStr = weekSunday.toISOString().split('T')[0];

    // 1. Latest weight: most recent body record with weight
    const latestBodyRow = await this.db
      .select()
      .from(lifeHealthRecords)
      .where(eq(lifeHealthRecords.recordType, 'body'))
      .orderBy(desc(lifeHealthRecords.recordDate), desc(lifeHealthRecords.createdAt))
      .limit(1);

    let latestWeight: number | null = null;
    if (latestBodyRow.length > 0) {
      const metrics = latestBodyRow[0].metrics as HealthMetrics;
      latestWeight = metrics.weight ?? null;
    }

    // 2. Weight trend: body records in date range, daily latest weight
    const weightTrendRows = await this.db
      .select({
        recordDate: lifeHealthRecords.recordDate,
        metrics: lifeHealthRecords.metrics,
        createdAt: lifeHealthRecords.createdAt,
      })
      .from(lifeHealthRecords)
      .where(
        and(
          eq(lifeHealthRecords.recordType, 'body'),
          gte(lifeHealthRecords.recordDate, startDateStr),
          lte(lifeHealthRecords.recordDate, endDateStr),
        ),
      )
      .orderBy(asc(lifeHealthRecords.recordDate), desc(lifeHealthRecords.createdAt));

    // Group by date, take latest per day
    const weightByDate = new Map<string, number>();
    for (const row of weightTrendRows) {
      const dateStr = row.recordDate;
      if (!weightByDate.has(dateStr)) {
        const metrics = row.metrics as HealthMetrics;
        if (metrics.weight !== undefined && metrics.weight !== null) {
          weightByDate.set(dateStr, metrics.weight);
        }
      }
    }

    const weightTrend: HealthTrendPoint[] = Array.from(weightByDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, value }));

    // 3 & 4. Exercise this week: count and total calories (Mon-Sun)
    const exerciseRows = await this.db
      .select({ metrics: lifeHealthRecords.metrics })
      .from(lifeHealthRecords)
      .where(
        and(
          eq(lifeHealthRecords.recordType, 'exercise'),
          gte(lifeHealthRecords.recordDate, weekMondayStr),
          lt(lifeHealthRecords.recordDate, weekSundayStr),
        ),
      );

    const exerciseThisWeek = exerciseRows.length;
    let totalCaloriesThisWeek = 0;
    for (const row of exerciseRows) {
      const metrics = row.metrics as HealthMetrics;
      if (metrics.calories !== undefined && metrics.calories !== null) {
        totalCaloriesThisWeek += metrics.calories;
      }
    }

    // 5 & 6. Sleep average over `days` days
    const sleepRows = await this.db
      .select({ metrics: lifeHealthRecords.metrics })
      .from(lifeHealthRecords)
      .where(
        and(
          eq(lifeHealthRecords.recordType, 'sleep'),
          gte(lifeHealthRecords.recordDate, startDateStr),
          lte(lifeHealthRecords.recordDate, endDateStr),
        ),
      );

    let totalSleepHours = 0;
    let totalSleepQuality = 0;
    let sleepHoursCount = 0;
    let sleepQualityCount = 0;

    for (const row of sleepRows) {
      const metrics = row.metrics as HealthMetrics;
      if (metrics.sleepHours !== undefined && metrics.sleepHours !== null) {
        totalSleepHours += metrics.sleepHours;
        sleepHoursCount += 1;
      }
      if (metrics.sleepQuality !== undefined && metrics.sleepQuality !== null) {
        totalSleepQuality += metrics.sleepQuality;
        sleepQualityCount += 1;
      }
    }

    const avgSleepHours = sleepHoursCount > 0
      ? Math.round((totalSleepHours / sleepHoursCount) * 10) / 10
      : 0;
    const avgSleepQuality = sleepQualityCount > 0
      ? Math.round((totalSleepQuality / sleepQualityCount) * 10) / 10
      : 0;

    return {
      latestWeight,
      weightTrend,
      exerciseThisWeek,
      totalCaloriesThisWeek,
      avgSleepHours,
      avgSleepQuality,
    };
  }
}


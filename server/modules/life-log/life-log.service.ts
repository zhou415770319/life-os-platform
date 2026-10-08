import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LOCAL_DATABASE } from '@server/storage/local-database.module';
import type { LocalDatabase } from '@server/storage/local-database';
import { eq, ne, like, ilike, and, or, desc, asc, count, gte, lte, gt, lt, sql } from '@server/storage/drizzle-compat';
import { lifeLifeLogs } from '@server/database/schema';
import type {
  LifeLogEntry,
  LifeLogCategory,
  ListResponse,
} from '@shared/api.interface';

interface ListQuery {
  eventType?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

interface CategoryStat {
  category: string;
  count: number;
}

@Injectable()
export class LifeLogService {
  private readonly logger = new Logger(LifeLogService.name);

  constructor(
    @Inject(LOCAL_DATABASE) private readonly db: LocalDatabase,
  ) {}

  private mapRowToEntry(row: typeof lifeLifeLogs.$inferSelect): LifeLogEntry {
    return {
      id: row.id,
      eventType: row.eventType,
      eventCategory: row.eventCategory as LifeLogCategory,
      contentSummary: row.contentSummary,
      metadata: (row.metadata ?? {}) as Record<string, string | number | boolean | null>,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async findAll(query: ListQuery): Promise<ListResponse<LifeLogEntry>> {
    const { eventType, category, startDate, endDate, page, pageSize } = query;

    const conditions = [];
    if (eventType) {
      conditions.push(eq(lifeLifeLogs.eventType, eventType));
    }
    if (category) {
      conditions.push(eq(lifeLifeLogs.eventCategory, category));
    }
    if (startDate) {
      conditions.push(gte(lifeLifeLogs.createdAt, new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(lifeLifeLogs.createdAt, end));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(lifeLifeLogs)
        .where(whereClause),
      this.db
        .select()
        .from(lifeLifeLogs)
        .where(whereClause)
        .orderBy(desc(lifeLifeLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items: LifeLogEntry[] = rows.map((row) => this.mapRowToEntry(row));

    return { items, total };
  }

  async findOne(id: string): Promise<LifeLogEntry> {
    const rows = await this.db
      .select()
      .from(lifeLifeLogs)
      .where(eq(lifeLifeLogs.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('日志不存在');
    }

    return this.mapRowToEntry(rows[0]);
  }

  async append(params: {
    eventType: string;
    eventCategory: LifeLogCategory;
    contentSummary: string;
    metadata?: Record<string, unknown>;
  }): Promise<LifeLogEntry> {
    const [row] = await this.db
      .insert(lifeLifeLogs)
      .values({
        eventType: params.eventType,
        eventCategory: params.eventCategory,
        contentSummary: params.contentSummary,
        metadata: params.metadata ?? {},
      })
      .returning();

    this.logger.log(`Life log appended: ${row.id} (${row.eventType})`);
    return this.mapRowToEntry(row);
  }

  async exportAll(): Promise<{
    data: LifeLogEntry[];
    exportTime: string;
    total: number;
  }> {
    const rows = await this.db
      .select()
      .from(lifeLifeLogs)
      .orderBy(desc(lifeLifeLogs.createdAt))
      .limit(10000);

    const data: LifeLogEntry[] = rows.map((row) => this.mapRowToEntry(row));

    return {
      data,
      exportTime: new Date().toISOString(),
      total: data.length,
    };
  }

  async getCategoryStats(): Promise<CategoryStat[]> {
    const rows = await this.db
      .select({
        category: lifeLifeLogs.eventCategory,
        count: count(),
      })
      .from(lifeLifeLogs)
      .groupBy(lifeLifeLogs.eventCategory)
      .orderBy(lifeLifeLogs.eventCategory);

    return rows.map((row) => ({
      category: row.category,
      count: Number(row.count),
    }));
  }
}


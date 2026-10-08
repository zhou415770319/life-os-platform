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
import { lifeTasks } from '@server/database/schema';
import { PomodoroService } from '@server/modules/pomodoro/pomodoro.service';
import { LifeLogService } from '@server/modules/life-log/life-log.service';
import type {
  LifeTask,
  CreateTaskDto,
  UpdateTaskDto,
  ListResponse,
  TaskSubtask,
} from '@shared/api.interface';

interface ListQuery {
  status?: string;
  priority?: string;
  quadrant?: string;
  project?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export interface TaskStatsSummary {
  statusCounts: Record<string, number>;
  quadrantCounts: Record<string, number>;
  todayDoneCount: number;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @Inject(LOCAL_DATABASE) private readonly db: LocalDatabase,
    private readonly pomodoroService: PomodoroService,
    private readonly lifeLogService: LifeLogService,
  ) {}

  private mapRowToTask(row: typeof lifeTasks.$inferSelect): LifeTask {
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? null,
      status: row.status as LifeTask['status'],
      priority: row.priority as LifeTask['priority'],
      quadrant: (row.quadrant as LifeTask['quadrant']) ?? null,
      dueDate: row.dueDate ?? null,
      tags: row.tags ?? [],
      project: row.project ?? null,
      context: row.context ?? null,
      subtasks: (row.subtasks as TaskSubtask[]) ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findAll(query: ListQuery): Promise<ListResponse<LifeTask>> {
    const { status, priority, quadrant, project, search, page, pageSize } = query;

    const conditions = [];
    if (status) {
      conditions.push(eq(lifeTasks.status, status));
    }
    if (priority) {
      conditions.push(eq(lifeTasks.priority, priority));
    }
    if (quadrant) {
      conditions.push(eq(lifeTasks.quadrant, quadrant));
    }
    if (project) {
      conditions.push(eq(lifeTasks.project, project));
    }
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(ilike(lifeTasks.title, searchPattern));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(lifeTasks)
        .where(whereClause),
      this.db
        .select()
        .from(lifeTasks)
        .where(whereClause)
        .orderBy(desc(lifeTasks.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items: LifeTask[] = rows.map((row) => this.mapRowToTask(row));

    return { items, total };
  }

  async findOne(id: string): Promise<LifeTask> {
    const rows = await this.db
      .select()
      .from(lifeTasks)
      .where(eq(lifeTasks.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('任务不存在');
    }

    return this.mapRowToTask(rows[0]);
  }

  async create(dto: CreateTaskDto, userId: string): Promise<LifeTask> {
    const [row] = await this.db
      .insert(lifeTasks)
      .values({
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        quadrant: dto.quadrant,
        dueDate: dto.dueDate,
        tags: dto.tags,
        project: dto.project,
        context: dto.context,
        subtasks: dto.subtasks as unknown as typeof lifeTasks.$inferInsert['subtasks'],
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    this.logger.log(`Task created: ${row.id} (${row.title})`);
    return this.mapRowToTask(row);
  }

  async update(
    id: string,
    dto: UpdateTaskDto,
    userId: string,
  ): Promise<LifeTask> {
    const before = await this.findOne(id);
    const patch: Partial<typeof lifeTasks.$inferInsert> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.priority !== undefined) patch.priority = dto.priority;
    if (dto.quadrant !== undefined) patch.quadrant = dto.quadrant;
    if (dto.dueDate !== undefined) patch.dueDate = dto.dueDate;
    if (dto.tags !== undefined) patch.tags = dto.tags;
    if (dto.project !== undefined) patch.project = dto.project;
    if (dto.context !== undefined) patch.context = dto.context;
    if (dto.subtasks !== undefined) {
      patch.subtasks = dto.subtasks as unknown as typeof lifeTasks.$inferInsert['subtasks'];
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();
    patch.updatedBy = userId;

    const [row] = await this.db
      .update(lifeTasks)
      .set(patch)
      .where(eq(lifeTasks.id, id))
      .returning();

    if (!row) {
      throw new NotFoundException('任务不存在');
    }

    // GTD 联动：任务完成自动记录人生日志
    if (dto.status === 'done' && before.status !== 'done') {
      try {
        await this.lifeLogService.append({
          eventType: 'task_completed',
          eventCategory: 'tasks',
          contentSummary: `完成任务：${row.title}`,
          metadata: { taskId: id },
        });
      } catch (err) {
        this.logger.warn(`Append task_completed log failed: ${String(err)}`);
      }
    }

    this.logger.log(`Task updated: ${id}`);
    return this.mapRowToTask(row);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const deleted = await this.db
      .delete(lifeTasks)
      .where(eq(lifeTasks.id, id))
      .returning({ id: lifeTasks.id });

    if (deleted.length === 0) {
      throw new NotFoundException('任务不存在');
    }

    this.logger.log(`Task deleted: ${id}`);
    return { success: true };
  }

  async getStatsSummary(): Promise<TaskStatsSummary> {
    // 各状态数量
    const statusRows = await this.db
      .select({
        status: lifeTasks.status,
        count: count(),
      })
      .from(lifeTasks)
      .groupBy(lifeTasks.status);

    const statusCounts: Record<string, number> = {};
    for (const row of statusRows) {
      statusCounts[row.status] = Number(row.count);
    }

    // 各象限数量
    const quadrantRows = await this.db
      .select({
        quadrant: lifeTasks.quadrant,
        count: count(),
      })
      .from(lifeTasks)
      .where(sql`${lifeTasks.quadrant} is not null`)
      .groupBy(lifeTasks.quadrant);

    const quadrantCounts: Record<string, number> = {};
    for (const row of quadrantRows) {
      if (row.quadrant) {
        quadrantCounts[row.quadrant] = Number(row.count);
      }
    }

    // 今日完成数
    const todayDoneResult = await this.db
      .select({ count: count() })
      .from(lifeTasks)
      .where(
        and(
          eq(lifeTasks.status, 'done'),
          sql`${lifeTasks.updatedAt}::date = CURRENT_DATE`,
        ),
      );

    const todayDoneCount = Number(todayDoneResult[0]?.count ?? 0);

    return {
      statusCounts,
      quadrantCounts,
      todayDoneCount,
    };
  }

  /** GTD 联动：各任务的番茄专注统计（次数/分钟） */
  getFocusStats(): Record<string, { count: number; minutes: number }> {
    return this.pomodoroService.getFocusStatsByTask();
  }
}


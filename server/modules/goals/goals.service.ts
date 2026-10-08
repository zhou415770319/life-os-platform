import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LOCAL_DATABASE } from '@server/storage/local-database.module';
import type { LocalDatabase } from '@server/storage/local-database';
import { eq, ne, like, ilike, and, or, desc, asc, count, gte, lte, gt, lt, sql } from '@server/storage/drizzle-compat';
import type { LifeGoal, CreateGoalDto, UpdateGoalDto } from '@shared/api.interface';
import { lifeGoals } from '@server/database/schema';

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(
    @Inject(LOCAL_DATABASE) private readonly db: LocalDatabase,
  ) {}

  private toGoal(row: typeof lifeGoals.$inferSelect): LifeGoal {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      progress: row.progress,
      category: row.category,
      deadline: row.deadline,
      milestones: (row.milestones ?? []) as LifeGoal['milestones'],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findAll(page?: number, pageSize?: number): Promise<{ items: LifeGoal[]; total: number }> {
    const size = pageSize ?? 0;
    const pageNum = page ?? 1;

    const query = this.db.select().from(lifeGoals).orderBy(desc(lifeGoals.createdAt));
    const paginatedQuery = size > 0
      ? query.limit(size).offset((pageNum - 1) * size)
      : query;

    const [rows, totalResult] = await Promise.all([
      paginatedQuery,
      this.db.select({ count: count() }).from(lifeGoals),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const items: LifeGoal[] = rows.map((row) => this.toGoal(row));

    this.logger.log(`Found ${items.length} goals`);
    return { items, total };
  }

  async findOne(id: string): Promise<LifeGoal> {
    const rows = await this.db.select().from(lifeGoals).where(eq(lifeGoals.id, id));
    if (rows.length === 0) {
      throw new NotFoundException('目标不存在');
    }
    return this.toGoal(rows[0]);
  }

  private computeProgressFromMilestones(milestones: { completed: boolean }[]): number {
    if (!milestones || milestones.length === 0) return 0;
    const completed = milestones.filter((m) => m.completed).length;
    return Math.round((completed / milestones.length) * 100);
  }

  async create(dto: CreateGoalDto): Promise<LifeGoal> {
    const milestones = dto.milestones ?? [];
    const hasMilestones = milestones.length > 0;
    const progress = hasMilestones
      ? this.computeProgressFromMilestones(milestones)
      : dto.progress ?? 0;
    const status = hasMilestones
      ? progress >= 100 ? 'completed' : 'active'
      : dto.status ?? 'active';

    const rows = await this.db
      .insert(lifeGoals)
      .values({
        title: dto.title,
        description: dto.description,
        status,
        progress,
        category: dto.category,
        deadline: dto.deadline,
        milestones,
      })
      .returning();

    this.logger.log(`Goal created: ${rows[0].id}`);
    return this.toGoal(rows[0]);
  }

  async update(id: string, dto: UpdateGoalDto): Promise<LifeGoal> {
    const patch: Partial<typeof lifeGoals.$inferInsert> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.progress !== undefined) patch.progress = dto.progress;
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.deadline !== undefined) patch.deadline = dto.deadline;
    if (dto.milestones !== undefined) {
      patch.milestones = dto.milestones;
      const ms = dto.milestones;
      if (ms.length > 0) {
        patch.progress = this.computeProgressFromMilestones(ms);
        patch.status = patch.progress >= 100 ? 'completed' : 'active';
      } else {
        // 空 milestones 时保留前端传入的 progress/status（如有）
        if (dto.progress !== undefined) patch.progress = dto.progress;
        if (dto.status !== undefined) patch.status = dto.status;
      }
    }

    if (Object.keys(patch).length === 0) {
      return this.findOne(id);
    }

    patch.updatedAt = new Date();

    const rows = await this.db
      .update(lifeGoals)
      .set(patch)
      .where(eq(lifeGoals.id, id))
      .returning();

    if (rows.length === 0) {
      throw new NotFoundException('目标不存在');
    }

    this.logger.log(`Goal updated: ${id}`);
    return this.toGoal(rows[0]);
  }

  async remove(id: string): Promise<void> {
    const rows = await this.db.delete(lifeGoals).where(eq(lifeGoals.id, id)).returning({ id: lifeGoals.id });
    if (rows.length === 0) {
      throw new NotFoundException('目标不存在');
    }
    this.logger.log(`Goal deleted: ${id}`);
  }
}


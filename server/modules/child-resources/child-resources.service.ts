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
import { lifeChildResources } from '@server/database/schema';
import type {
  ChildResource,
  CreateChildResourceDto,
  UpdateChildResourceDto,
  ListResponse,
} from '@shared/api.interface';

interface ListQuery {
  category?: string;
  search?: string;
  resourceType?: string;
  page: number;
  pageSize: number;
}

@Injectable()
export class ChildResourcesService {
  private readonly logger = new Logger(ChildResourcesService.name);

  constructor(
    @Inject(LOCAL_DATABASE) private readonly db: LocalDatabase,
  ) {}

  private mapRowToResource(row: typeof lifeChildResources.$inferSelect): ChildResource {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      series: row.series ?? null,
      resourceType: row.resourceType,
      description: row.description ?? null,
      resourceUrl: row.resourceUrl ?? null,
      level: row.level ?? null,
      icon: row.icon ?? null,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findAll(query: ListQuery): Promise<ListResponse<ChildResource>> {
    const { category, search, resourceType, page, pageSize } = query;

    const conditions = [];
    if (category) {
      conditions.push(eq(lifeChildResources.category, category));
    }
    if (resourceType) {
      conditions.push(eq(lifeChildResources.resourceType, resourceType));
    }
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(lifeChildResources.name, searchPattern),
          ilike(lifeChildResources.description, searchPattern),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(lifeChildResources)
        .where(whereClause),
      this.db
        .select()
        .from(lifeChildResources)
        .where(whereClause)
        .orderBy(asc(lifeChildResources.sortOrder), desc(lifeChildResources.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items: ChildResource[] = rows.map((row) => this.mapRowToResource(row));

    return { items, total };
  }

  async findOne(id: string): Promise<ChildResource> {
    const rows = await this.db
      .select()
      .from(lifeChildResources)
      .where(eq(lifeChildResources.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('资源不存在');
    }

    return this.mapRowToResource(rows[0]);
  }

  async create(dto: CreateChildResourceDto, userId: string): Promise<ChildResource> {
    if (dto.resourceUrl && !/^https?:\/\//.test(dto.resourceUrl)) {
      throw new BadRequestException('resourceUrl 必须以 http:// 或 https:// 开头');
    }

    const [row] = await this.db
      .insert(lifeChildResources)
      .values({
        name: dto.name,
        category: dto.category,
        series: dto.series,
        resourceType: dto.resourceType,
        description: dto.description,
        resourceUrl: dto.resourceUrl,
        level: dto.level,
        icon: dto.icon,
        sortOrder: dto.sortOrder,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    this.logger.log(`Child resource created: ${row.id} (${row.name})`);
    return this.mapRowToResource(row);
  }

  async update(
    id: string,
    dto: UpdateChildResourceDto,
    userId: string,
  ): Promise<ChildResource> {
    if (dto.resourceUrl !== undefined && dto.resourceUrl !== '') {
      if (!/^https?:\/\//.test(dto.resourceUrl)) {
        throw new BadRequestException('resourceUrl 必须以 http:// 或 https:// 开头');
      }
    }

    const patch: Partial<typeof lifeChildResources.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.series !== undefined) patch.series = dto.series;
    if (dto.resourceType !== undefined) patch.resourceType = dto.resourceType;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.resourceUrl !== undefined) patch.resourceUrl = dto.resourceUrl;
    if (dto.level !== undefined) patch.level = dto.level;
    if (dto.icon !== undefined) patch.icon = dto.icon;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();
    patch.updatedBy = userId;

    const [row] = await this.db
      .update(lifeChildResources)
      .set(patch)
      .where(eq(lifeChildResources.id, id))
      .returning();

    if (!row) {
      throw new NotFoundException('资源不存在');
    }

    this.logger.log(`Child resource updated: ${id}`);
    return this.mapRowToResource(row);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const deleted = await this.db
      .delete(lifeChildResources)
      .where(eq(lifeChildResources.id, id))
      .returning({ id: lifeChildResources.id });

    if (deleted.length === 0) {
      throw new NotFoundException('资源不存在');
    }

    this.logger.log(`Child resource deleted: ${id}`);
    return { success: true };
  }

  async getCategories(): Promise<{ items: string[] }> {
    const rows = await this.db
      .select({ category: lifeChildResources.category })
      .from(lifeChildResources)
      .groupBy(lifeChildResources.category)
      .orderBy(asc(lifeChildResources.category));

    const items = rows.map((row) => row.category).filter((c): c is string => !!c);
    return { items };
  }
}


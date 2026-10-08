import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LOCAL_DATABASE } from '@server/storage/local-database.module';
import type { LocalDatabase } from '@server/storage/local-database';
import { eq, ne, like, ilike, and, or, desc, asc, count, gte, lte, gt, lt, sql } from '@server/storage/drizzle-compat';
import { lifeNotes, lifePrinciples, lifeQuickLinks } from '@server/database/schema';
import type {
  LifeNote,
  CreateNoteDto,
  UpdateNoteDto,
  LifePrinciple,
  CreatePrincipleDto,
  QuickLink,
  CreateQuickLinkDto,
} from '@shared/api.interface';

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(
    @Inject(LOCAL_DATABASE) private readonly db: LocalDatabase,
  ) {}

  async findAllNotes(page?: number, pageSize?: number): Promise<{ items: LifeNote[]; total: number }> {
    const size = pageSize ?? 0;
    const pageNum = page ?? 1;

    const query = this.db
      .select()
      .from(lifeNotes)
      .orderBy(desc(lifeNotes.isPinned), desc(lifeNotes.createdAt));
    const paginatedQuery = size > 0
      ? query.limit(size).offset((pageNum - 1) * size)
      : query;

    const [rows, totalResult] = await Promise.all([
      paginatedQuery,
      this.db.select({ count: count() }).from(lifeNotes),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const items: LifeNote[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      tags: row.tags ?? [],
      isPinned: row.isPinned,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return { items, total };
  }

  async createNote(dto: CreateNoteDto): Promise<LifeNote> {
    const [row] = await this.db
      .insert(lifeNotes)
      .values({
        title: dto.title,
        content: dto.content,
        tags: dto.tags ?? [],
        isPinned: dto.isPinned ?? false,
      })
      .returning();

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      tags: row.tags ?? [],
      isPinned: row.isPinned,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateNote(id: string, dto: UpdateNoteDto): Promise<LifeNote> {
    const patch: Partial<typeof lifeNotes.$inferInsert> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.content !== undefined) patch.content = dto.content;
    if (dto.tags !== undefined) patch.tags = dto.tags;
    if (dto.isPinned !== undefined) patch.isPinned = dto.isPinned;

    const [row] = await this.db
      .update(lifeNotes)
      .set(patch)
      .where(eq(lifeNotes.id, id))
      .returning();

    if (!row) {
      throw new NotFoundException('笔记不存在');
    }

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      tags: row.tags ?? [],
      isPinned: row.isPinned,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async deleteNote(id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(lifeNotes)
      .where(eq(lifeNotes.id, id))
      .returning({ id: lifeNotes.id });

    if (!deleted) {
      throw new NotFoundException('笔记不存在');
    }
  }

  async findAllPrinciples(page?: number, pageSize?: number): Promise<{ items: LifePrinciple[]; total: number }> {
    const size = pageSize ?? 0;
    const pageNum = page ?? 1;

    const query = this.db
      .select()
      .from(lifePrinciples)
      .orderBy(desc(lifePrinciples.createdAt));
    const paginatedQuery = size > 0
      ? query.limit(size).offset((pageNum - 1) * size)
      : query;

    const [rows, totalResult] = await Promise.all([
      paginatedQuery,
      this.db.select({ count: count() }).from(lifePrinciples),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const items: LifePrinciple[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return { items, total };
  }

  async createPrinciple(dto: CreatePrincipleDto): Promise<LifePrinciple> {
    const [row] = await this.db
      .insert(lifePrinciples)
      .values({
        title: dto.title,
        content: dto.content,
        category: dto.category,
      })
      .returning();

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async deletePrinciple(id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(lifePrinciples)
      .where(eq(lifePrinciples.id, id))
      .returning({ id: lifePrinciples.id });

    if (!deleted) {
      throw new NotFoundException('原则不存在');
    }
  }

  async findAllQuickLinks(page?: number, pageSize?: number): Promise<{ items: QuickLink[]; total: number }> {
    const size = pageSize ?? 0;
    const pageNum = page ?? 1;

    const query = this.db
      .select()
      .from(lifeQuickLinks)
      .orderBy(asc(lifeQuickLinks.sortOrder));
    const paginatedQuery = size > 0
      ? query.limit(size).offset((pageNum - 1) * size)
      : query;

    const [rows, totalResult] = await Promise.all([
      paginatedQuery,
      this.db.select({ count: count() }).from(lifeQuickLinks),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const items: QuickLink[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      icon: row.icon,
      category: row.category,
      sortOrder: row.sortOrder,
    }));

    return { items, total };
  }

  async createQuickLink(dto: CreateQuickLinkDto): Promise<QuickLink> {
    const [row] = await this.db
      .insert(lifeQuickLinks)
      .values({
        title: dto.title,
        url: dto.url,
        icon: dto.icon,
        category: dto.category,
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();

    return {
      id: row.id,
      title: row.title,
      url: row.url,
      icon: row.icon,
      category: row.category,
      sortOrder: row.sortOrder,
    };
  }

  async deleteQuickLink(id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(lifeQuickLinks)
      .where(eq(lifeQuickLinks.id, id))
      .returning({ id: lifeQuickLinks.id });

    if (!deleted) {
      throw new NotFoundException('快速链接不存在');
    }
  }
}


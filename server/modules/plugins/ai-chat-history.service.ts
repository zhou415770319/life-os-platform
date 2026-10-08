import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LOCAL_DATABASE } from '@server/storage/local-database.module';
import type { LocalDatabase } from '@server/storage/local-database';
import { eq, ne, like, ilike, and, or, desc, asc, count, gte, lte, gt, lt, sql } from '@server/storage/drizzle-compat';
import { lifeAiChatSessions, lifeAiChatHistory } from '@server/database/schema';
import type {
  AiChatSession,
  AiChatSessionMessage,
  ChatToolCall,
  PreflightCheckStep,
} from '@shared/api.interface';

@Injectable()
export class AiChatHistoryService {
  constructor(
    @Inject(LOCAL_DATABASE)
    private readonly db: LocalDatabase,
  ) {}

  async listSessions(userId: string): Promise<{ items: AiChatSession[]; total: number }> {
    const [countResult] = await this.db
      .select({ count: count() })
      .from(lifeAiChatSessions)
      .where(eq(lifeAiChatSessions.createdBy, userId));

    const rows = await this.db
      .select({
        id: lifeAiChatSessions.id,
        title: lifeAiChatSessions.title,
        createdAt: lifeAiChatSessions.createdAt,
        updatedAt: lifeAiChatSessions.updatedAt,
      })
      .from(lifeAiChatSessions)
      .where(eq(lifeAiChatSessions.createdBy, userId))
      .orderBy(desc(lifeAiChatSessions.createdAt))
      .limit(50);

    const items: AiChatSession[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return {
      items,
      total: Number(countResult.count),
    };
  }

  async getSessionMessages(
    sessionId: string,
    userId: string,
  ): Promise<AiChatSessionMessage[]> {
    await this.verifySessionOwnership(sessionId, userId);

    const rows = await this.db
      .select({
        id: lifeAiChatHistory.id,
        role: lifeAiChatHistory.role,
        content: lifeAiChatHistory.content,
        createdAt: lifeAiChatHistory.createdAt,
        toolCalls: lifeAiChatHistory.toolCalls,
        preflightChecks: lifeAiChatHistory.preflightChecks,
      })
      .from(lifeAiChatHistory)
      .where(eq(lifeAiChatHistory.sessionId, sessionId))
      .orderBy(asc(lifeAiChatHistory.createdAt));

    return rows.map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      toolCalls: (row.toolCalls as ChatToolCall[]) ?? undefined,
      preflightChecks: (row.preflightChecks as PreflightCheckStep[]) ?? undefined,
    }));
  }

  async createSession(userId: string, title?: string): Promise<AiChatSession> {
    const now = new Date();
    const [row] = await this.db
      .insert(lifeAiChatSessions)
      .values({
        title: title ?? '新对话',
        createdBy: userId,
        updatedBy: userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: lifeAiChatSessions.id,
        title: lifeAiChatSessions.title,
        createdAt: lifeAiChatSessions.createdAt,
        updatedAt: lifeAiChatSessions.updatedAt,
      });

    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async ensureSession(
    sessionId: string | undefined,
    userId: string,
    firstUserMessage: string,
  ): Promise<string> {
    if (sessionId) {
      await this.verifySessionOwnership(sessionId, userId);
      await this.updateSessionTimestamp(sessionId, userId);
      return sessionId;
    }

    const derivedTitle = firstUserMessage.slice(0, 30) || '新对话';
    const session = await this.createSession(userId, derivedTitle);
    return session.id;
  }

  async saveMessage(params: {
    sessionId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCalls?: unknown[];
    preflightChecks?: unknown[];
    userId: string;
  }): Promise<void> {
    const { sessionId, role, content, toolCalls, preflightChecks, userId } = params;

    await this.db.insert(lifeAiChatHistory).values({
      sessionId,
      role,
      content,
      toolCalls: toolCalls ? JSON.stringify(toolCalls) : '[]',
      preflightChecks: preflightChecks ? JSON.stringify(preflightChecks) : '[]',
      createdBy: userId,
      updatedBy: userId,
    });

    await this.updateSessionTimestamp(sessionId, userId);
  }

  async updateSessionTitle(
    sessionId: string,
    title: string,
    userId: string,
  ): Promise<void> {
    await this.verifySessionOwnership(sessionId, userId);

    const updated = await this.db
      .update(lifeAiChatSessions)
      .set({
        title,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(lifeAiChatSessions.id, sessionId))
      .returning({ id: lifeAiChatSessions.id });

    if (updated.length === 0) {
      throw new NotFoundException('会话不存在');
    }
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    await this.verifySessionOwnership(sessionId, userId);

    await this.db
      .delete(lifeAiChatHistory)
      .where(eq(lifeAiChatHistory.sessionId, sessionId));

    const deleted = await this.db
      .delete(lifeAiChatSessions)
      .where(
        and(
          eq(lifeAiChatSessions.id, sessionId),
          eq(lifeAiChatSessions.createdBy, userId),
        ),
      )
      .returning({ id: lifeAiChatSessions.id });

    if (deleted.length === 0) {
      throw new NotFoundException('会话不存在');
    }
  }

  private async verifySessionOwnership(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    const [row] = await this.db
      .select({ id: lifeAiChatSessions.id })
      .from(lifeAiChatSessions)
      .where(
        and(
          eq(lifeAiChatSessions.id, sessionId),
          eq(lifeAiChatSessions.createdBy, userId),
        ),
      );

    if (!row) {
      throw new NotFoundException('会话不存在');
    }
  }

  private async updateSessionTimestamp(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    await this.db
      .update(lifeAiChatSessions)
      .set({
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(lifeAiChatSessions.id, sessionId));
  }
}




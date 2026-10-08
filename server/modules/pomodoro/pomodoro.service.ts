import { Injectable, NotFoundException } from '@nestjs/common';
import { JsonStore } from '@server/storage/json-store';

export interface PomodoroRecord {
  id: string;
  taskName: string;
  durationMinutes: number;
  /** ISO 时间 */
  startedAt: string;
  completedAt: string;
  /** 是否中途放弃 */
  abandoned: boolean;
  /** 关联 GTD 任务 ID（可选） */
  taskId?: string;
}

@Injectable()
export class PomodoroService {
  private readonly store = new JsonStore<PomodoroRecord>('pomodoro-records.json');

  async getRecords(): Promise<PomodoroRecord[]> {
    const rows = this.store.findAll();
    return rows.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  }

  async getStats(): Promise<{
    totalCount: number;
    totalMinutes: number;
    todayCount: number;
    todayMinutes: number;
    focusRate: number;
  }> {
    const rows = this.store.findAll();
    const todayStr = new Date().toISOString().slice(0, 10);
    const completed = rows.filter((r) => !r.abandoned);
    const today = completed.filter((r) => r.completedAt.startsWith(todayStr));
    const totalMinutes = completed.reduce((s, r) => s + r.durationMinutes, 0);
    const todayMinutes = today.reduce((s, r) => s + r.durationMinutes, 0);
    return {
      totalCount: completed.length,
      totalMinutes,
      todayCount: today.length,
      todayMinutes,
      focusRate:
        rows.length > 0 ? Math.round((completed.length / rows.length) * 100) : 100,
    };
  }

  async createRecord(dto: {
    taskName?: string;
    durationMinutes: number;
    completedAt: string;
    abandoned?: boolean;
    taskId?: string;
  }): Promise<PomodoroRecord> {
    const record: PomodoroRecord = {
      id: crypto.randomUUID(),
      taskName: dto.taskName?.trim() || '未命名专注',
      durationMinutes: dto.durationMinutes,
      startedAt: new Date(Date.parse(dto.completedAt) - dto.durationMinutes * 60_000).toISOString(),
      completedAt: dto.completedAt,
      abandoned: dto.abandoned ?? false,
      ...(dto.taskId ? { taskId: dto.taskId } : {}),
    };
    return this.store.create(record);
  }

  async deleteRecord(id: string): Promise<void> {
    const removed = this.store.remove(id);
    if (!removed) throw new NotFoundException('记录不存在');
  }

  /** 按任务聚合专注统计（仅供 GTD 联动使用） */
  getFocusStatsByTask(): Record<string, { count: number; minutes: number }> {
    const rows = this.store.findAll().filter((r) => !r.abandoned && r.taskId);
    const map: Record<string, { count: number; minutes: number }> = {};
    for (const r of rows) {
      if (!r.taskId) continue;
      const entry = map[r.taskId] ?? { count: 0, minutes: 0 };
      entry.count += 1;
      entry.minutes += r.durationMinutes;
      map[r.taskId] = entry;
    }
    return map;
  }
}

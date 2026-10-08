import { Injectable, NotFoundException } from '@nestjs/common';
import { JsonStore } from '@server/storage/json-store';

export interface TimeBlackholeRecord {
  id: string;
  /** 浪费类型：idle 发呆 / shortvideo 刷短视频 / gossip 八卦闲聊 / other 其他 */
  category: string;
  note: string;
  /** 浪费时长（分钟） */
  durationMinutes: number;
  /** 记录日期 YYYY-MM-DD */
  recordDate: string;
  createdAt: string;
}

@Injectable()
export class TimeBlackholeService {
  private readonly store =
    new JsonStore<TimeBlackholeRecord>('time-blackhole-records.json');

  private getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async getRecords(recordDate?: string): Promise<TimeBlackholeRecord[]> {
    const rows = this.store.findAll();
    const filtered = recordDate
      ? rows.filter((r) => r.recordDate === recordDate)
      : rows;
    return filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async getStats(): Promise<{
    todayMinutes: number;
    todayCount: number;
    totalMinutes: number;
    byCategory: Record<string, number>;
  }> {
    const rows = this.store.findAll();
    const today = this.getToday();
    const todayRows = rows.filter((r) => r.recordDate === today);
    const byCategory: Record<string, number> = {};
    for (const r of rows) {
      byCategory[r.category] = (byCategory[r.category] ?? 0) + r.durationMinutes;
    }
    return {
      todayMinutes: todayRows.reduce((s, r) => s + r.durationMinutes, 0),
      todayCount: todayRows.length,
      totalMinutes: rows.reduce((s, r) => s + r.durationMinutes, 0),
      byCategory,
    };
  }

  async createRecord(dto: {
    category: string;
    note?: string;
    durationMinutes: number;
    recordDate?: string;
  }): Promise<TimeBlackholeRecord> {
    const record: TimeBlackholeRecord = {
      id: crypto.randomUUID(),
      category: dto.category,
      note: dto.note?.trim() || '',
      durationMinutes: dto.durationMinutes,
      recordDate: dto.recordDate || this.getToday(),
      createdAt: new Date().toISOString(),
    };
    return this.store.create(record);
  }

  async deleteRecord(id: string): Promise<void> {
    const removed = this.store.remove(id);
    if (!removed) throw new NotFoundException('记录不存在');
  }
}

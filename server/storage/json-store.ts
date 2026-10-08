import * as fs from 'fs';
import * as path from 'path';

/**
 * 轻量 JSON 文件存储（用于无 drizzle schema 表的内置模块：番茄钟、时间黑洞等）
 * 与 LocalDatabase 同目录（user-data/），后期可平滑迁移数据库。
 */
export class JsonStore<T extends { id: string }> {
  private readonly filePath: string;

  constructor(fileName: string) {
    const dir =
      process.env.STORAGE_DATA_DIR || path.join(process.cwd(), 'user-data');
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, fileName);
  }

  private read(): T[] {
    if (!fs.existsSync(this.filePath)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private write(rows: T[]): void {
    fs.writeFileSync(this.filePath, JSON.stringify(rows, null, 2), 'utf-8');
  }

  findAll(): T[] {
    return this.read();
  }

  create(row: T): T {
    const rows = this.read();
    rows.push(row);
    this.write(rows);
    return row;
  }

  update(id: string, patch: Partial<T>): T | null {
    const rows = this.read();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    rows[idx] = { ...rows[idx], ...patch };
    this.write(rows);
    return rows[idx];
  }

  remove(id: string): T | null {
    const rows = this.read();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    const [removed] = rows.splice(idx, 1);
    this.write(rows);
    return removed;
  }

  /** 整体替换（导入备份用） */
  replaceAll(rows: T[]): void {
    this.write(rows);
  }
}

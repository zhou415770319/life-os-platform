import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface InviteCodeRecord {
  code: string;
  createdBy: string; // 生成者 userId
  createdAt: string;
  expiresAt: string; // ISO
  usedBy?: string; // 使用人 userId
  usedAt?: string;
  revoked?: boolean;
}

/**
 * 邀请码存储（user-data/invite-codes.json）
 * 管理员生成邀请码，新用户凭码注册；支持作废与状态查询。
 */
@Injectable()
export class InviteCodeStore {
  private readonly logger = new Logger(InviteCodeStore.name);
  private readonly file: string;
  private cache: InviteCodeRecord[] | null = null;

  constructor() {
    const dir =
      process.env.STORAGE_DATA_DIR || path.join(process.cwd(), 'user-data');
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'invite-codes.json');
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.file)) {
        this.cache = [];
        this.flush();
        return;
      }
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
      this.cache = Array.isArray(raw) ? raw : [];
    } catch (err) {
      this.logger.error(`邀请码数据读取失败：${String(err)}`);
      this.cache = [];
    }
  }

  private flush(): void {
    fs.writeFileSync(this.file, JSON.stringify(this.cache ?? [], null, 2), 'utf-8');
  }

  private get list(): InviteCodeRecord[] {
    if (!this.cache) this.load();
    return this.cache!;
  }

  /** 生成随机邀请码（8 位大写字母+数字，去掉易混淆字符） */
  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (;;) {
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      if (!this.list.some((r) => r.code === code)) return code;
    }
  }

  create(creatorId: string, opts: { count?: number; days?: number } = {}): InviteCodeRecord[] {
    const count = Math.max(1, Math.min(opts.count ?? 1, 50));
    const days = opts.days ?? 30;
    const now = Date.now();
    const expires = new Date(now + days * 24 * 3600_000).toISOString();
    const created: InviteCodeRecord[] = [];
    for (let i = 0; i < count; i++) {
      const rec: InviteCodeRecord = {
        code: this.generateCode(),
        createdBy: creatorId,
        createdAt: new Date(now).toISOString(),
        expiresAt: expires,
      };
      this.list.push(rec);
      created.push(rec);
    }
    this.flush();
    return created;
  }

  findAll(): InviteCodeRecord[] {
    return [...this.list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  findByCode(code: string): InviteCodeRecord | undefined {
    const c = String(code ?? '').trim().toUpperCase();
    return this.list.find((r) => r.code === c);
  }

  revoke(code: string): boolean {
    const rec = this.findByCode(code);
    if (!rec) return false;
    rec.revoked = true;
    this.flush();
    return true;
  }

  /** 校验并消费邀请码（注册时调用）；失败抛错信息供 controller 转 400 */
  consume(code: string, userId: string): void {
    const rec = this.findByCode(code);
    if (!rec) throw new Error('邀请码不存在');
    if (rec.revoked) throw new Error('邀请码已作废');
    if (rec.usedBy) throw new Error('邀请码已被使用');
    if (Date.now() > new Date(rec.expiresAt).getTime()) throw new Error('邀请码已过期');
    rec.usedBy = userId;
    rec.usedAt = new Date().toISOString();
    this.flush();
  }

  /** 启动时清理：作废/过期但未使用的码可保留（可再生成），不强制清理 */
  cleanupExpired(): void {
    // 保留历史记录，供管理员查看
  }
}

import { Injectable } from '@nestjs/common';
import { JsonStore } from '@server/storage/json-store';
import {
  CreateUserInput,
  StoredUser,
  UserStore,
} from './user-store.interface';

/**
 * 本地 JSON 用户存储：user-data/users.json
 * 与项目其余本地数据同目录（STORAGE_DATA_DIR 可覆盖），后期迁移数据库时替换实现即可。
 */
@Injectable()
export class LocalUserStore implements UserStore {
  private readonly store: JsonStore<StoredUser>;

  constructor() {
    this.store = new JsonStore<StoredUser>('users.json');
  }

  findAll(): StoredUser[] {
    return this.store.findAll();
  }

  findByUsername(username: string): StoredUser | null {
    const name = String(username ?? '').trim().toLowerCase();
    if (!name) return null;
    return this.store.findAll().find((u) => u.username.toLowerCase() === name) ?? null;
  }

  create(input: CreateUserInput): StoredUser {
    const now = new Date().toISOString();
    const user: StoredUser = {
      id: input.id ?? `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      username: String(input.username).trim(),
      passwordHash: input.passwordHash,
      salt: input.salt,
      role: input.role,
      createdAt: input.createdAt ?? now,
    };
    this.store.create(user);
    return user;
  }

  count(): number {
    return this.store.findAll().length;
  }

  /** 按 id 删除用户（注册回滚等场景） */
  remove(userId: string): boolean {
    return !!this.store.remove(userId);
  }
}

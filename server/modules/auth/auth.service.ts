import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { LocalUserStore } from './local-user.store';
import { InviteCodeStore } from './invite-code.store';
import { StoredUser, UserRole } from './user-store.interface';

export interface AuthTokenPayload {
  u: string; // userId
  r: UserRole;
  exp: number;
}

export interface AuthResult {
  token: string;
  username: string;
  role: UserRole;
  expiresIn: number;
}

/** 登录/注册限流：同 IP 连续失败 5 次锁 15 分钟 */
interface RateLimitEntry {
  fails: number;
  lockUntil: number;
}

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const TOKEN_TTL_MS = 7 * 24 * 3600_000;

/**
 * 用户系统核心：scrypt 密码哈希 + HMAC-SHA256 token（与 child-tv 同机制）。
 * 首用户注册免邀请码（自动成为管理员），之后注册需管理员邀请码（新用户为普通角色）。
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly secret: string;
  private readonly rateLimits = new Map<string, RateLimitEntry>();

  constructor(
    private readonly userStore: LocalUserStore,
    private readonly inviteCodeStore: InviteCodeStore,
  ) {
    this.secret = this.loadSecret();
  }

  // ==================== 密钥 ====================

  /** AUTH_SECRET 优先；否则首次生成随机密钥持久化到 user-data/auth-secret（重启 token 不失效） */
  private loadSecret(): string {
    if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.trim()) {
      return process.env.AUTH_SECRET.trim();
    }
    const dir =
      process.env.STORAGE_DATA_DIR || path.join(process.cwd(), 'user-data');
    const file = path.join(dir, 'auth-secret');
    if (fs.existsSync(file)) {
      return fs.readFileSync(file, 'utf-8').trim();
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, generated, { encoding: 'utf-8', mode: 0o600 });
    this.logger.warn(
      '未配置 AUTH_SECRET，已自动生成并持久化到 user-data/auth-secret（生产建议在 .env 显式配置）',
    );
    return generated;
  }

  // ==================== 密码 ====================

  private hashPassword(password: string, salt: string): string {
    return crypto.scryptSync(password, salt, 64).toString('hex');
  }

  private verifyPassword(password: string, salt: string, expected: string): boolean {
    const actual = Buffer.from(this.hashPassword(password, salt), 'hex');
    const want = Buffer.from(expected, 'hex');
    if (actual.length !== want.length) return false;
    return crypto.timingSafeEqual(actual, want);
  }

  // ==================== Token ====================

  issueToken(user: StoredUser): string {
    const payload = Buffer.from(
      JSON.stringify({ u: user.id, r: user.role, exp: Date.now() + TOKEN_TTL_MS }),
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }

  parseToken(token: string): AuthTokenPayload | null {
    try {
      const data = JSON.parse(
        Buffer.from(token.split('.')[0], 'base64url').toString('utf-8'),
      ) as AuthTokenPayload;
      return data && typeof data.u === 'string' && data.exp ? data : null;
    } catch {
      return null;
    }
  }

  verifyToken(token: string | null | undefined): AuthTokenPayload | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expect = crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
    if (sig.length !== expect.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    const data = this.parseToken(token);
    if (!data || !data.exp || data.exp < Date.now()) return null;
    return data;
  }

  // ==================== 限流 ====================

  private checkRateLimit(key: string): void {
    const entry = this.rateLimits.get(key);
    if (entry && entry.lockUntil > Date.now()) {
      throw new UnauthorizedException('尝试次数过多，请 15 分钟后再试');
    }
  }

  private recordFailure(key: string): void {
    const entry = this.rateLimits.get(key) ?? { fails: 0, lockUntil: 0 };
    entry.fails += 1;
    if (entry.fails >= MAX_FAILS) {
      entry.lockUntil = Date.now() + LOCK_MS;
      entry.fails = 0;
    }
    this.rateLimits.set(key, entry);
  }

  private clearFailure(key: string): void {
    this.rateLimits.delete(key);
  }

  // ==================== 业务 ====================

  /** 系统是否已初始化（已有用户） */
  isInitialized(): boolean {
    return this.userStore.count() > 0;
  }

  /** 注册：仅当系统无任何用户时允许，首用户自动成为管理员 */
  register(username: string, password: string, inviteCode?: string): AuthResult {
    const name = String(username ?? '').trim();
    if (name.length < 2 || name.length > 32) {
      throw new BadRequestException('用户名长度需在 2-32 个字符之间');
    }
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5-]+$/.test(name)) {
      throw new BadRequestException('用户名仅支持字母、数字、下划线、中文和连字符');
    }
    if (String(password ?? '').length < 8) {
      throw new BadRequestException('密码长度至少 8 位');
    }
    const isFirstUser = this.userStore.count() === 0;
    // 首用户免邀请码（自动成为管理员）；其余需有效邀请码
    if (!isFirstUser && !inviteCode?.trim()) {
      throw new BadRequestException('注册需要邀请码');
    }
    if (this.userStore.findByUsername(name)) {
      throw new BadRequestException('用户名已存在');
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const user = this.userStore.create({
      username: name,
      passwordHash: this.hashPassword(password, salt),
      salt,
      role: isFirstUser ? 'admin' : 'user',
    });
    // 非首用户：创建成功后消费邀请码（store 内部二次校验防并发重复使用）
    if (!isFirstUser) {
      try {
        this.inviteCodeStore.consume(String(inviteCode).trim(), user.id);
      } catch (err) {
        // 邀请码消费失败（并发/异常）：回滚刚创建的用户，保持注册原子性
        this.userStore.remove(user.id);
        throw new BadRequestException(
          err instanceof Error ? err.message : '邀请码无效',
        );
      }
    }
    this.logger.log(
      isFirstUser
        ? `首个管理员账号已创建：${user.username}`
        : `新用户已注册（邀请码）：${user.username}`,
    );
    return this.buildAuthResult(user);
  }

  /** 邀请码：生成 / 列表 / 作废（供 Controller 使用） */
  createInviteCodes(creatorId: string, opts?: { count?: number; days?: number }) {
    return this.inviteCodeStore.create(creatorId, opts);
  }

  listInviteCodes() {
    return this.inviteCodeStore.findAll();
  }

  revokeInviteCode(code: string): boolean {
    return this.inviteCodeStore.revoke(code);
  }

  login(username: string, password: string, ipKey?: string): AuthResult {
    this.checkRateLimit(ipKey ?? 'global');
    const user = this.userStore.findByUsername(username);
    if (!user || !this.verifyPassword(password ?? '', user.salt, user.passwordHash)) {
      this.recordFailure(ipKey ?? 'global');
      throw new UnauthorizedException('用户名或密码错误');
    }
    this.clearFailure(ipKey ?? 'global');
    return this.buildAuthResult(user);
  }

  /** 校验 token 并返回用户（供 Guard 与 /me 使用） */
  resolveByToken(token: string | null | undefined): { user: StoredUser; payload: AuthTokenPayload } | null {
    const payload = this.verifyToken(token);
    if (!payload) return null;
    const user = this.userStore.findAll().find((u) => u.id === payload.u) ?? null;
    if (!user) return null;
    return { user, payload };
  }

  private buildAuthResult(user: StoredUser): AuthResult {
    return {
      token: this.issueToken(user),
      username: user.username,
      role: user.role,
      expiresIn: TOKEN_TTL_MS,
    };
  }
}

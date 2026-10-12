import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec, spawn, ChildProcess } from 'child_process';
import { Observable, Subject } from 'rxjs';
import { JsonStore } from '@server/storage/json-store';
import type {
  ChildTvAccountInfo,
  ChildTvAuthInfo,
  ChildTvBrowseResult,
  ChildTvLogEntry,
  ChildTvNextSchedule,
  ChildTvRuntimeStatus,
  ChildTvSchedule,
  ChildTvScheduleInput,
  ChildTvSettings,
  ChildTvStatsEntry,
  ChildTvSyncEvent,
  ChildTvSyncState,
} from '@shared/api.interface';

/** 媒体扩展名分类 */
const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.webm', '.m4v', '.ts', '.m2ts']);
const AUDIO_EXTS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.wma']);
const MEDIA_EXTS = new Set([...VIDEO_EXTS, ...AUDIO_EXTS]);

/** 账号（多账号体系：parent + child） */
interface ChildTvAccount {
  username: string;
  salt: string;
  /** sha256(salt + password) */
  passwordHash: string;
  role: 'parent' | 'child';
  /** 显示名（儿童昵称） */
  displayName: string;
  /** 观看页 PIN 哈希（sha256 加盐），null 表示未启用 */
  pinHash: string | null;
  /** child 账号归属的家长用户名；parent 为 null */
  boundTo: string | null;
  /** 家长端生成的绑定码（儿童端受控模式凭此连接家长端） */
  bindCode: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthFile {
  accounts: ChildTvAccount[];
  updatedAt: string;
}

/** 账号级锁定状态（家长端记录，下发给对应儿童端执行） */
interface ChildLockState {
  reason: 'playback' | 'manual' | 'remote';
  endsAt: string | null;
  updatedAt: string;
}

interface PlayerSession {
  proc: ChildProcess;
  scheduleId: string | null;
  title: string;
  startedAt: string;
  endsAt: string;
  manual: boolean;
  /** 停止原因 */
  stopReason: string | null;
}

/** 家长端 SSE 广播连接（account -> 推送通道） */
interface SseConnection {
  account: string;
  subject: Subject<{ data: string }>;
}

const LOCK_RELEASE_FILE = '.child-tv-lock-release';
const LOCK_HEARTBEAT_FILE = '.child-tv-lock-heartbeat';
const LOCK_SCRIPT_FILE = '.child-tv-lock.ps1';
const M3U_FILE = 'child-tv-playlist.m3u';
const SECRET_FILE = 'child-tv-secret.txt';
const LOCKS_FILE = 'child-tv-locks.json';
/** 受控模式 SSE 断线后重连间隔（毫秒） */
const SYNC_RECONNECT_MS = 3_000;

@Injectable()
export class ChildTvService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('ChildTv');
  /** 服务/数据文件统一放在插件自身目录下（与线上市场安装的插件结构一致：user-data/plugins/<key>/） */
  private readonly dataDir = path.resolve(process.cwd(), 'user-data', 'plugins', 'dsh-plugin-child-tv', 'data');
  /** 更早版本：数据存放在 user-data/ 根目录 */
  private readonly legacyDataDir = path.resolve(process.cwd(), 'user-data');
  /** 早期版本：数据存放在服务源码目录内 */
  private readonly legacySrcDataDir = path.resolve(process.cwd(), 'server', 'modules', 'child-tv', 'data');
  private readonly schedulesStore = new JsonStore<ChildTvSchedule>('child-tv-schedules.json', this.dataDir);
  private readonly logsStore = new JsonStore<ChildTvLogEntry>('child-tv-log.json', this.dataDir);
  private readonly statsStore = new JsonStore<ChildTvStatsEntry>('child-tv-stats.json', this.dataDir);

  private authFile = path.join(this.dataDir, 'child-tv-auth.json');
  private settingsFile = path.join(this.dataDir, 'child-tv-settings.json');
  private locksFile = path.join(this.dataDir, LOCKS_FILE);
  private secret: string;

  private player: PlayerSession | null = null;
  private lockProc: ChildProcess | null = null;
  private lockReason: 'playback' | 'manual' | 'remote' | null = null;
  private lockEndsAt: string | null = null;
  private lockTimer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private lastLog = '';
  private adminCached: boolean | null = null;
  private mpvPathCached: string | null | undefined;

  /** 账号级锁定状态：username -> ChildLockState（家长端权威数据） */
  private childLocks: Record<string, ChildLockState> = {};
  /** 家长端当前下发给儿童端的播放指令（双机模式） */
  private syncPlaying: { scheduleId: string | null; title: string; endsAt: string | null } = {
    scheduleId: null,
    title: '',
    endsAt: null,
  };
  /** 同步状态版本号（儿童端据此判断变化） */
  private syncVersion = 0;
  /** 家长端 SSE 广播连接 */
  private sseClients: SseConnection[] = [];
  /** 儿童端受控模式轮询/重连定时器 */
  private controlledTimer: NodeJS.Timeout | null = null;
  /** 儿童端受控模式是否激活 */
  private controlledActive = false;

  constructor() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.migrateLegacyFiles();
    this.secret = this.loadOrCreateSecret();
    this.ensureAuthFile();
    this.ensureSettingsFile();
    this.ensureSeedSchedules();
    this.loadChildLocks();
  }

  /** 将历史版本的本插件服务文件迁移到插件目录下（文件已存在则不覆盖） */
  private migrateLegacyFiles(): void {
    const legacyFiles = [
      'child-tv-schedules.json',
      'child-tv-log.json',
      'child-tv-stats.json',
      'child-tv-auth.json',
      'child-tv-settings.json',
      'child-tv-secret.txt',
      'child-tv-playlist.m3u',
      'child-tv-locks.json',
    ];
    // 迁移来源优先级：user-data/ 根目录（更早版本）→ server/modules/child-tv/data（早期版本）
    for (const srcDir of [this.legacyDataDir, this.legacySrcDataDir]) {
      for (const name of legacyFiles) {
        const src = path.join(srcDir, name);
        const dst = path.join(this.dataDir, name);
        if (fs.existsSync(src) && !fs.existsSync(dst)) {
          try {
            fs.copyFileSync(src, dst);
            this.logger.log(`已迁移 ${name} → ${this.dataDir}`);
          } catch (e) {
            this.logger.warn(`迁移 ${name} 失败: ${(e as Error).message}`);
          }
        }
      }
    }
  }

  /** 打开本插件服务文件所在文件夹（Windows 资源管理器；其他平台仅返回路径） */
  openDataDir(): { success: boolean; dataDir: string } {
    try {
      if (process.platform === 'win32') {
        const { spawn } = require('child_process') as typeof import('child_process');
        spawn('explorer.exe', [this.dataDir], { detached: true, stdio: 'ignore' }).unref();
      } else if (process.platform === 'darwin') {
        const { spawn } = require('child_process') as typeof import('child_process');
        spawn('open', [this.dataDir], { detached: true, stdio: 'ignore' }).unref();
      } else {
        const { spawn } = require('child_process') as typeof import('child_process');
        spawn('xdg-open', [this.dataDir], { detached: true, stdio: 'ignore' }).unref();
      }
      return { success: true, dataDir: this.dataDir };
    } catch (e) {
      this.logger.warn(`打开数据目录失败: ${(e as Error).message}`);
      return { success: false, dataDir: this.dataDir };
    }
  }

  // ==================== 生命周期 ====================

  onModuleInit(): void {
    // 服务启动：解除遗留锁定（进程重启即解锁）
    this.releaseLockFile();
    this.log('info', '儿童定时播放服务启动');
    const settings = this.readSettings();
    if (settings.controlled?.enabled && settings.controlled.parentUrl) {
      // 儿童端受控模式：连接家长端，接收锁定/播放指令；本机调度由家长端驱动
      this.controlledActive = true;
      void this.controlledSyncLoop();
      this.log('info', `受控模式已启用，家长端：${settings.controlled.parentUrl}（账号 ${settings.controlled.childUsername}）`);
    } else {
      // 单机/家长端模式：本机调度引擎
      this.tickTimer = setInterval(() => void this.tick(), 15_000);
      void this.tick();
    }
  }

  onModuleDestroy(): void {
    this.controlledActive = false;
    if (this.controlledTimer) clearInterval(this.controlledTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.lockTimer) clearTimeout(this.lockTimer);
    this.stopPlayback('服务停止');
    this.releaseLockFile();
    this.log('info', '儿童定时播放服务停止');
  }

  // ==================== 存储基础 ====================

  private loadOrCreateSecret(): string {
    const p = path.join(this.dataDir, SECRET_FILE);
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8').trim();
    } catch { /* ignore */ }
    const s = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(p, s, 'utf-8');
    return s;
  }

  private readJson<T>(p: string, fallback: T): T {
    try {
      if (!fs.existsSync(p)) return fallback;
      return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
    } catch {
      return fallback;
    }
  }

  private writeJson(p: string, data: unknown): void {
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  }

  private hash(secret: string, value: string): string {
    return crypto.createHash('sha256').update(secret + value).digest('hex');
  }

  private readAuth(): AuthFile {
    return this.readJson<AuthFile>(this.authFile, {
      accounts: [],
      updatedAt: new Date().toISOString(),
    });
  }

  private writeAuth(auth: AuthFile): void {
    this.writeJson(this.authFile, auth);
  }

  private ensureAuthFile(): void {
    if (!fs.existsSync(this.authFile)) {
      const salt = crypto.randomBytes(16).toString('hex');
      const now = new Date().toISOString();
      this.writeAuth({
        accounts: [
          {
            username: 'admin',
            salt,
            passwordHash: this.hash(salt, '123456'),
            role: 'parent',
            displayName: '管理员',
            pinHash: null,
            boundTo: null,
            bindCode: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
        updatedAt: now,
      });
      this.log('info', '已创建默认家长账号 admin（密码 123456，sha256 加盐存储）');
      return;
    }
    // 旧版单账号格式迁移为多账号
    const raw = this.readJson<Record<string, unknown> & { accounts?: unknown }>(this.authFile, {});
    if (!Array.isArray(raw.accounts)) {
      const legacy = raw as unknown as {
        username?: string;
        salt?: string;
        passwordHash?: string;
        pinHash?: string | null;
        updatedAt?: string;
      };
      const now = new Date().toISOString();
      this.writeAuth({
        accounts: [
          {
            username: legacy.username ?? 'admin',
            salt: legacy.salt ?? crypto.randomBytes(16).toString('hex'),
            passwordHash: legacy.passwordHash ?? this.hash(legacy.salt ?? '', '123456'),
            role: 'parent',
            displayName: legacy.username ?? 'admin',
            pinHash: legacy.pinHash ?? null,
            boundTo: null,
            bindCode: null,
            createdAt: legacy.updatedAt ?? now,
            updatedAt: now,
          },
        ],
        updatedAt: now,
      });
      this.log('info', `已迁移旧版单账号 → 多账号体系（${legacy.username ?? 'admin'} 为家长账号）`);
    }
  }

  private ensureSettingsFile(): void {
    if (!fs.existsSync(this.settingsFile)) {
      this.writeSettings(this.defaultSettings());
    }
  }

  private defaultSettings(): ChildTvSettings {
    return {
      pinHash: null,
      defaultLockMinutes: 240,
      immediatePlayDurationMinutes: 120,
      mpvPath: '',
      controlled: {
        enabled: false,
        parentUrl: '',
        childUsername: '',
        bindCode: '',
      },
    };
  }

  readSettings(): ChildTvSettings {
    return {
      ...this.defaultSettings(),
      ...this.readJson<Partial<ChildTvSettings>>(this.settingsFile, {}),
      controlled: {
        ...this.defaultSettings().controlled,
        ...(this.readJson<Partial<ChildTvSettings>>(this.settingsFile, {}).controlled ?? {}),
      },
    };
  }

  private writeSettings(s: ChildTvSettings): void {
    this.writeJson(this.settingsFile, s);
  }

  private ensureSeedSchedules(): void {
    if (this.schedulesStore.findAll().length > 0) return;
    const now = new Date().toISOString();
    const seeds: ChildTvSchedule[] = [
      {
        id: crypto.randomUUID(),
        name: '纪录片',
        start: '06:00',
        durationMinutes: 60,
        sourceType: 'folder',
        source: '',
        mediaType: 'video',
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: '英语',
        start: '07:30',
        durationMinutes: 30,
        sourceType: 'folder',
        source: '',
        mediaType: 'video',
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: '喜马拉雅',
        start: '20:00',
        durationMinutes: 60,
        sourceType: 'folder',
        source: '',
        mediaType: 'audio',
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
    for (const s of seeds) this.schedulesStore.create(s);
    this.log('info', '已预置三个默认时段（纪录片/英语/喜马拉雅），内容来源待设置');
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    const entry: ChildTvLogEntry = {
      id: crypto.randomUUID(),
      time: new Date().toISOString(),
      level,
      message,
    };
    this.logsStore.create(entry);
    this.lastLog = message;
    const rows = this.logsStore.findAll();
    if (rows.length > 200) {
      this.logsStore.replaceAll(rows.slice(rows.length - 200));
    }
    if (level === 'error') this.logger.error(message);
    else if (level === 'warn') this.logger.warn(message);
    else this.logger.log(message);
  }

  getLogs(limit = 50): ChildTvLogEntry[] {
    const rows = this.logsStore.findAll();
    return rows.slice(-limit).reverse();
  }

  getStats(): ChildTvStatsEntry[] {
    return this.statsStore.findAll().slice(-100).reverse();
  }

  // ==================== 鉴权（多账号：parent / child） ====================

  private findAccount(username: string): ChildTvAccount | null {
    const auth = this.readAuth();
    return auth.accounts.find((a) => a.username === username) ?? null;
  }

  private issueToken(account: ChildTvAccount): string {
    const payload = Buffer.from(
      JSON.stringify({ u: account.username, r: account.role, exp: Date.now() + 7 * 24 * 3600_000 }),
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }

  private parseToken(token: string): { u: string; r?: string; exp?: number } | null {
    try {
      const data = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf-8')) as {
        u: string;
        r?: string;
        exp?: number;
      };
      return data;
    } catch {
      return null;
    }
  }

  private verifyToken(token: string | null | undefined): boolean {
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payload, sig] = parts;
    const expect = crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return false;
    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as { exp?: number };
      return !!data.exp && data.exp > Date.now();
    } catch {
      return false;
    }
  }

  private extractToken(req: { headers?: Record<string, string | string[] | undefined> }): string | null {
    const h = req.headers ?? {};
    const auth = h.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
    const cookie = h.cookie;
    if (typeof cookie === 'string') {
      const m = cookie.match(/(?:^|;\s*)child_tv_token=([^;]+)/);
      if (m) return decodeURIComponent(m[1]);
    }
    return null;
  }

  /** 返回当前登录账号（未登录返回 null） */
  private currentAccount(req: { headers?: Record<string, string | string[] | undefined> }): ChildTvAccount | null {
    const token = this.extractToken(req);
    if (!this.verifyToken(token)) return null;
    const data = this.parseToken(token);
    if (!data?.u) return null;
    return this.findAccount(data.u);
  }

  /** 校验登录；未登录抛 401 */
  requireAuth(req: { headers?: Record<string, string | string[] | undefined> }): ChildTvAccount {
    const acc = this.currentAccount(req);
    if (!acc) throw new UnauthorizedException('请先登录控制台');
    return acc;
  }

  /** 校验家长角色；非家长账号抛 401（儿童账号只能看，不能控制） */
  requireParent(req: { headers?: Record<string, string | string[] | undefined> }): ChildTvAccount {
    const acc = this.requireAuth(req);
    if (acc.role !== 'parent') throw new UnauthorizedException('该操作需要家长账号');
    return acc;
  }

  async login(username: string, password: string): Promise<{
    token: string;
    username: string;
    role: 'parent' | 'child';
    displayName: string;
  }> {
    const account = this.findAccount(username);
    if (!account || this.hash(account.salt, password ?? '') !== account.passwordHash) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    return {
      token: this.issueToken(account),
      username: account.username,
      role: account.role,
      displayName: account.displayName,
    };
  }

  authInfo(req: { headers?: Record<string, string | string[] | undefined> }): ChildTvAuthInfo {
    const acc = this.currentAccount(req);
    if (!acc) {
      return { loggedIn: false, username: '', role: null, displayName: '', pinEnabled: false };
    }
    return {
      loggedIn: true,
      username: acc.username,
      role: acc.role,
      displayName: acc.displayName,
      pinEnabled: !!acc.pinHash,
    };
  }

  /** 校验观看页 PIN（未启用时直接通过） */
  checkPin(pin: string): { ok: boolean } {
    const acc = this.currentAccountForPin();
    if (!acc || !acc.pinHash) return { ok: true };
    return { ok: this.hash(acc.salt, pin ?? '') === acc.pinHash };
  }

  private currentAccountForPin(): ChildTvAccount | null {
    // PIN 校验针对"默认家长账号"（兼容旧版单账号语义）；多账号下观看页可另行校验
    const auth = this.readAuth();
    return auth.accounts.find((a) => a.role === 'parent') ?? auth.accounts[0] ?? null;
  }

  async updateAccount(
    req: { headers?: Record<string, string | string[] | undefined> },
    dto: { password?: string; pin?: string | null },
  ): Promise<{ username: string; pinEnabled: boolean }> {
    const acc = this.requireAuth(req);
    const auth = this.readAuth();
    const idx = auth.accounts.findIndex((a) => a.username === acc.username);
    if (idx < 0) throw new NotFoundException('账号不存在');
    if (dto.password !== undefined && dto.password !== '') {
      auth.accounts[idx].passwordHash = this.hash(auth.accounts[idx].salt, dto.password);
      auth.accounts[idx].updatedAt = new Date().toISOString();
    }
    if (dto.pin !== undefined) {
      if (dto.pin === null || dto.pin === '') auth.accounts[idx].pinHash = null;
      else auth.accounts[idx].pinHash = this.hash(auth.accounts[idx].salt, dto.pin);
      auth.accounts[idx].updatedAt = new Date().toISOString();
    }
    this.writeAuth(auth);
    return { username: acc.username, pinEnabled: !!auth.accounts[idx].pinHash };
  }

  // ==================== 账号管理（家长） ====================

  /** 家长创建儿童账号 */
  createChildAccount(dto: {
    username: string;
    password: string;
    displayName?: string;
  }): ChildTvAccountInfo {
    const name = (dto?.username ?? '').trim();
    if (!name) throw new BadRequestException('账号名不能为空');
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/.test(name)) {
      throw new BadRequestException('账号名需 2-20 位字母/数字/下划线/中文');
    }
    if (!dto?.password) throw new BadRequestException('密码不能为空');
    const auth = this.readAuth();
    if (auth.accounts.some((a) => a.username === name)) {
      throw new BadRequestException(`账号「${name}」已存在`);
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const now = new Date().toISOString();
    const account: ChildTvAccount = {
      username: name,
      salt,
      passwordHash: this.hash(salt, dto.password),
      role: 'child',
      displayName: dto.displayName?.trim() || name,
      pinHash: null,
      boundTo: null,
      bindCode: null,
      createdAt: now,
      updatedAt: now,
    };
    auth.accounts.push(account);
    this.writeAuth(auth);
    this.log('info', `家长创建儿童账号「${name}」`);
    return this.toAccountInfo(account);
  }

  /** 家长为儿童账号生成/刷新绑定码（儿童端受控模式凭此连接） */
  generateBindCode(username: string): ChildTvAccountInfo {
    const auth = this.readAuth();
    const acc = auth.accounts.find((a) => a.username === username);
    if (!acc) throw new NotFoundException('账号不存在');
    if (acc.role !== 'child') throw new BadRequestException('只有儿童账号可生成绑定码');
    acc.bindCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    acc.updatedAt = new Date().toISOString();
    this.writeAuth(auth);
    this.log('info', `已为儿童账号「${username}」生成绑定码`);
    return this.toAccountInfo(acc);
  }

  /** 家长删除儿童账号（保留播放统计等数据） */
  deleteChildAccount(username: string): { success: boolean } {
    const auth = this.readAuth();
    const acc = auth.accounts.find((a) => a.username === username);
    if (!acc) throw new NotFoundException('账号不存在');
    if (acc.role !== 'child') throw new BadRequestException('只能删除儿童账号');
    auth.accounts = auth.accounts.filter((a) => a.username !== username);
    this.writeAuth(auth);
    delete this.childLocks[username];
    this.saveChildLocks();
    this.log('info', `家长删除儿童账号「${username}」`);
    return { success: true };
  }

  /** 家长列出全部账号（含锁定状态） */
  listAccounts(): ChildTvAccountInfo[] {
    const auth = this.readAuth();
    return auth.accounts.map((a) => this.toAccountInfo(a));
  }

  private toAccountInfo(a: ChildTvAccount): ChildTvAccountInfo {
    const lock = this.childLocks[a.username];
    return {
      username: a.username,
      role: a.role,
      displayName: a.displayName,
      boundTo: a.boundTo,
      bindCode: a.bindCode,
      locked: !!lock,
      lockReason: lock?.reason ?? null,
      lockEndsAt: lock?.endsAt ?? null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  // ==================== 账号级锁定（家长端权威状态） ====================

  private loadChildLocks(): void {
    this.childLocks = this.readJson<Record<string, ChildLockState>>(this.locksFile, {});
  }

  private saveChildLocks(): void {
    this.writeJson(this.locksFile, this.childLocks);
  }

  private bumpSync(): void {
    this.syncVersion += 1;
  }

  /** 锁定指定儿童账号：记录状态 + 广播给儿童端；儿童端收到后本机锁键 */
  lockChildAccount(username: string, minutes: number): ChildTvAccountInfo {
    const acc = this.findAccount(username);
    if (!acc) throw new NotFoundException('账号不存在');
    if (acc.role !== 'child') throw new BadRequestException('只能锁定儿童账号');
    const m = Math.min(Math.max(Number(minutes) || this.readSettings().defaultLockMinutes, 1), 1440);
    this.childLocks[username] = {
      reason: 'manual',
      endsAt: new Date(Date.now() + m * 60_000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveChildLocks();
    this.bumpSync();
    this.broadcast({ type: 'lock', account: username, reason: 'manual', minutes: m });
    this.log('info', `家长锁定儿童账号「${username}」（最长 ${m} 分钟）`);
    return this.toAccountInfo(acc);
  }

  /** 解锁指定儿童账号 */
  unlockChildAccount(username: string): ChildTvAccountInfo {
    const acc = this.findAccount(username);
    if (!acc) throw new NotFoundException('账号不存在');
    delete this.childLocks[username];
    this.saveChildLocks();
    this.bumpSync();
    this.broadcast({ type: 'unlock', account: username });
    this.log('info', `家长解锁儿童账号「${username}」`);
    return this.toAccountInfo(acc);
  }

  /** 当前是否处于双机模式：存在已连接的儿童端 */
  private hasControlledClients(): boolean {
    return this.sseClients.length > 0;
  }

  async updateSettings(patch: Partial<ChildTvSettings>): Promise<ChildTvSettings> {
    const cur = this.readSettings();
    const next: ChildTvSettings = {
      ...cur,
      ...patch,
      pinHash: cur.pinHash, // PIN 由 updateAccount 管理
      controlled: {
        ...cur.controlled,
        ...(patch.controlled ?? {}),
      },
    };
    this.writeSettings(next);
    this.mpvPathCached = undefined; // mpv 路径可能已变更，强制下次重检
    // 受控模式启停：切换时重启同步器
    const wasActive = this.controlledActive;
    const shouldActive = !!(next.controlled?.enabled && next.controlled.parentUrl);
    if (shouldActive !== wasActive) {
      this.controlledActive = shouldActive;
      if (shouldActive) {
        this.log('info', `受控模式已启用，家长端：${next.controlled.parentUrl}（账号 ${next.controlled.childUsername}）`);
        void this.controlledSyncLoop();
      } else {
        this.log('info', '受控模式已停用，恢复本机调度');
        this.tickTimer = setInterval(() => void this.tick(), 15_000);
        void this.tick();
      }
    }
    return next;
  }

  // ==================== 时段 ====================

  getSchedules(): ChildTvSchedule[] {
    return this.schedulesStore.findAll().sort((a, b) => (a.start < b.start ? -1 : 1));
  }

  private validateScheduleInput(dto: ChildTvScheduleInput): void {
    if (!dto.name?.trim()) throw new BadRequestException('时段名称不能为空');
    if (!/^\d{2}:\d{2}$/.test(dto.start || '')) throw new BadRequestException('开始时间格式应为 HH:MM');
    const [h, m] = dto.start.split(':').map(Number);
    if (h > 23 || m > 59) throw new BadRequestException('开始时间不合法');
    const dur = Number(dto.durationMinutes);
    if (!Number.isFinite(dur) || dur < 1 || dur > 1440) {
      throw new BadRequestException('时长需在 1-1440 分钟之间');
    }
    if (!['folder', 'file', 'url'].includes(dto.sourceType)) {
      throw new BadRequestException('内容来源类型不合法');
    }
    if (!dto.source?.trim()) throw new BadRequestException('内容来源不能为空');
    if (dto.sourceType === 'url' && !/^https?:\/\//i.test(dto.source)) {
      throw new BadRequestException('URL 需以 http:// 或 https:// 开头');
    }
    if (!['video', 'audio'].includes(dto.mediaType)) {
      throw new BadRequestException('类型需为视频或音频');
    }
  }

  createSchedule(dto: ChildTvScheduleInput): ChildTvSchedule {
    this.validateScheduleInput(dto);
    this.checkScheduleConflict(dto.start, Number(dto.durationMinutes), null);
    const now = new Date().toISOString();
    const row: ChildTvSchedule = {
      id: crypto.randomUUID(),
      name: dto.name.trim(),
      start: dto.start,
      durationMinutes: Number(dto.durationMinutes),
      sourceType: dto.sourceType,
      source: dto.source.trim(),
      mediaType: dto.mediaType,
      enabled: dto.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.schedulesStore.create(row);
    this.bumpSync();
    this.broadcast({ type: 'schedule-change', account: '*' });
    this.log('info', `新增时段「${row.name}」${row.start} 起 ${row.durationMinutes} 分钟`);
    return row;
  }

  updateSchedule(id: string, dto: Partial<ChildTvScheduleInput>): ChildTvSchedule {
    const existing = this.schedulesStore.findAll().find((s) => s.id === id);
    if (!existing) throw new NotFoundException('时段不存在');
    const next = { ...existing, ...dto, id: existing.id };
    this.validateScheduleInput(next as ChildTvScheduleInput);
    this.checkScheduleConflict(next.start, Number(next.durationMinutes), id);
    const updated = this.schedulesStore.update(id, {
      ...next,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) throw new NotFoundException('时段不存在');
    this.bumpSync();
    this.broadcast({ type: 'schedule-change', account: '*' });
    this.log('info', `修改时段「${updated.name}」`);
    return updated;
  }

  deleteSchedule(id: string): { success: boolean } {
    const removed = this.schedulesStore.remove(id);
    if (!removed) throw new NotFoundException('时段不存在');
    this.bumpSync();
    this.broadcast({ type: 'schedule-change', account: '*' });
    this.log('info', `删除时段「${removed.name}」`);
    return { success: true };
  }

  /** 时段冲突检测（优化点 2）：重叠拒绝（允许多时段同时段——不，按需求提示冲突） */
  private checkScheduleConflict(start: string, durationMinutes: number, excludeId: string | null): void {
    const [h, m] = start.split(':').map(Number);
    const startMin = h * 60 + m;
    const endMin = startMin + durationMinutes;
    const schedules = this.schedulesStore.findAll().filter((s) => s.id !== excludeId && s.enabled);
    for (const s of schedules) {
      const [sh, sm] = s.start.split(':').map(Number);
      const sStart = sh * 60 + sm;
      const sEnd = sStart + s.durationMinutes;
      if (this.rangesOverlap(startMin, endMin, sStart, sEnd)) {
        throw new BadRequestException(
          `时段「${s.name}」(${s.start} 起 ${s.durationMinutes} 分钟) 与当前时段时间重叠，请调整`,
        );
      }
    }
  }

  private rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
    const inWin = (min: number, s: number, e: number): boolean => {
      if (e <= 1440) return min >= s && min < e;
      return min >= s || min < e - 1440; // 跨天
    };
    return inWin(aStart, bStart, bEnd) || inWin(aEnd - 1, bStart, bEnd);
  }

  /** 当前分钟是否处于时段窗口内（支持跨天） */
  private inWindow(s: ChildTvSchedule, nowMin: number): boolean {
    const [h, m] = s.start.split(':').map(Number);
    const startMin = h * 60 + m;
    const endMin = startMin + s.durationMinutes;
    return this.rangesOverlap(nowMin, nowMin + 1, startMin, endMin);
  }

  private nextSchedule(nowMin: number): { s: ChildTvSchedule; startsInMinutes: number } | null {
    const schedules = this.schedulesStore.findAll().filter((s) => s.enabled);
    let best: { s: ChildTvSchedule; startsInMinutes: number } | null = null;
    for (const s of schedules) {
      const [h, m] = s.start.split(':').map(Number);
      const startMin = h * 60 + m;
      let delta = startMin - nowMin;
      if (delta < 0) delta += 1440;
      if (!best || delta < best.startsInMinutes) {
        best = { s, startsInMinutes: delta };
      }
    }
    return best;
  }

  // ==================== mpv 检测 ====================

  private isAdmin(): boolean {
    if (this.adminCached !== null) return this.adminCached;
    try {
      const out = execSyncSafe('net session');
      this.adminCached = out !== null;
    } catch {
      this.adminCached = false;
    }
    return this.adminCached;
  }

  private detectMpv(): string | null {
    const settings = this.readSettings();
    // 仅当设置未变化时使用缓存；用户新填/修改 mpv 路径后强制重新检测
    if (this.mpvPathCached !== undefined && this.mpvPathCached === settings.mpvPath) {
      return this.mpvPathCached;
    }
    let found: string | null = null;
    if (settings.mpvPath && fs.existsSync(settings.mpvPath)) {
      found = settings.mpvPath;
    } else {
      const which = execSyncSafe('where mpv');
      if (which) {
        const first = which.split(/\r?\n/)[0]?.trim();
        if (first) found = first;
      }
      if (!found) {
        const candidates = [
          path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'mpv', 'mpv.exe'),
          path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'mpv', 'mpv.exe'),
          'C:\\tools\\mpv\\mpv.exe',
          'C:\\mpv\\mpv.exe',
          path.join(os.homedir(), 'scoop', 'apps', 'mpv', 'current', 'mpv.exe'),
        ];
        for (const c of candidates) {
          if (fs.existsSync(c)) {
            found = c;
            break;
          }
        }
      }
    }
    this.mpvPathCached = found;
    return found;
  }

  // ==================== 播放 ====================

  private resolveResource(s: ChildTvSchedule): { title: string; args: string[] } {
    if (s.sourceType === 'url') {
      return { title: s.name, args: [s.source] };
    }
    if (s.sourceType === 'file') {
      if (!fs.existsSync(s.source)) {
        throw new BadRequestException(`文件不存在：${s.source}`);
      }
      return { title: s.name, args: [s.source] };
    }
    // folder：扫描全部音视频，按文件名排序生成 m3u 循环
    if (!fs.existsSync(s.source) || !fs.statSync(s.source).isDirectory()) {
      throw new BadRequestException(`文件夹不存在：${s.source}`);
    }
    const files: string[] = [];
    const walk = (dir: string): void => {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.name.startsWith('.')) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (MEDIA_EXTS.has(path.extname(e.name).toLowerCase())) files.push(full);
      }
    };
    walk(s.source);
    files.sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
    if (files.length === 0) throw new BadRequestException(`文件夹内未找到音视频文件：${s.source}`);
    const m3u = path.join(this.dataDir, M3U_FILE);
    fs.writeFileSync(m3u, files.map((f) => `#EXTINF:0,${path.basename(f)}\n${f}`).join('\n'), 'utf-8');
    return { title: `${s.name}（合集 ${files.length} 集）`, args: [m3u, '--loop-playlist=inf'] };
  }

  private buildMpvArgs(s: ChildTvSchedule, args: string[]): string[] {
    const common = [
      '--fullscreen',
      '--no-border',
      '--save-position-on-quit',
      '--resume-playback',
      '--quiet',
      '--keep-open=no',
      '--force-window=yes',
    ];
    if (s.mediaType === 'audio') common.push('--no-video');
    return [...common, ...args];
  }

  async startPlayback(scheduleId: string, manual: boolean): Promise<ChildTvRuntimeStatus> {
    const schedule = this.schedulesStore.findAll().find((s) => s.id === scheduleId);
    if (!schedule) throw new NotFoundException('时段不存在');
    if (!schedule.enabled && !manual) throw new BadRequestException('该时段未启用');

    if (this.player) {
      this.stopPlayback('切换播放内容');
    }
    const mpv = this.detectMpv();
    if (!mpv) {
      this.log('error', `未检测到 mpv，无法播放「${schedule.name}」（请安装 mpv 或在设置中配置路径）`);
      throw new BadRequestException('未检测到 mpv 播放器，请安装后重试');
    }

    let resolved: { title: string; args: string[] };
    try {
      resolved = this.resolveResource(schedule);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log('error', `播放「${schedule.name}」失败：${msg}`);
      throw new BadRequestException(msg);
    }

    const durationMs =
      (manual
        ? this.readSettings().immediatePlayDurationMinutes
        : schedule.durationMinutes) * 60_000;
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + durationMs);

    const proc = spawn(mpv, this.buildMpvArgs(schedule, resolved.args), {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    proc.on('error', (err) => {
      this.log('error', `mpv 启动失败：${err.message}`);
      if (this.player?.proc === proc) this.player = null;
    });
    proc.on('exit', (code) => {
      this.log('info', `mpv 退出（code=${code}）「${resolved.title}」`);
      if (this.player?.proc === proc) {
        this.player = null;
        this.finishStats(resolved.title, schedule.id, manual, startedAt, new Date(), this.player?.stopReason ?? '播放结束');
        // 自动锁随播放结束解除
        if (this.lockReason === 'playback') this.unlock();
      }
    });

    this.player = {
      proc,
      scheduleId: schedule.id,
      title: resolved.title,
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      manual,
      stopReason: null,
    };
    // 播放自动锁定（仅当没有手动锁）
    if (this.lockReason !== 'manual') {
      this.startLock(this.readSettings().defaultLockMinutes, 'playback');
    }
    this.log('info', `${manual ? '家长手动' : '定时'}播放开始「${resolved.title}」${schedule.mediaType === 'audio' ? '(音频)' : '(视频)'}`);
    return this.getRuntimeStatus();
  }

  stopPlayback(reason: string): { success: boolean } {
    // 双机模式：家长端本机不播放，只下发停止指令给儿童端
    if (this.hasControlledClients() && this.syncPlaying.scheduleId) {
      this.syncPlaying = { scheduleId: null, title: '', endsAt: null };
      this.bumpSync();
      this.broadcast({ type: 'stop', account: '*' });
      this.log('info', `双机模式：下发停止指令给儿童端（${reason}）`);
      return { success: true };
    }
    if (this.player) {
      this.player.stopReason = reason;
      const pid = this.player.proc.pid;
      try {
        // taskkill /T 连子进程一起结束（Windows 更可靠）
        exec(`taskkill /PID ${pid} /T /F`, () => undefined);
      } catch {
        try {
          this.player.proc.kill();
        } catch { /* ignore */ }
      }
      this.log('info', `停止播放：${reason}`);
      this.player = null;
      if (this.lockReason === 'playback') this.unlock();
    }
    return { success: true };
  }

  /** 手动立即播放指定时段（双机模式下发儿童端执行） */
  async playNow(scheduleId: string): Promise<ChildTvRuntimeStatus> {
    if (this.hasControlledClients()) {
      const schedule = this.schedulesStore.findAll().find((s) => s.id === scheduleId);
      if (!schedule) throw new NotFoundException('时段不存在');
      const durationMs = this.readSettings().immediatePlayDurationMinutes * 60_000;
      const endsAt = new Date(Date.now() + durationMs).toISOString();
      this.syncPlaying = { scheduleId, title: schedule.name, endsAt };
      this.bumpSync();
      this.broadcast({ type: 'play', account: '*', scheduleId, title: schedule.name, endsAt });
      this.log('info', `双机模式：下发播放指令「${schedule.name}」给儿童端`);
      return this.getRuntimeStatus();
    }
    return this.startPlayback(scheduleId, true);
  }

  // ==================== 锁定 ====================

  private releaseLockFile(): void {
    try {
      fs.writeFileSync(path.join(this.dataDir, LOCK_RELEASE_FILE), Date.now().toString(), 'utf-8');
    } catch { /* ignore */ }
  }

  private removeReleaseFile(): void {
    try {
      fs.unlinkSync(path.join(this.dataDir, LOCK_RELEASE_FILE));
    } catch { /* ignore */ }
  }

  private lockScript(minutes: number): string {
    const release = path.join(this.dataDir, LOCK_RELEASE_FILE);
    const hb = path.join(this.dataDir, LOCK_HEARTBEAT_FILE);
    return [
      'param([int]$MaxMinutes = 240)',
      '$ErrorActionPreference = "SilentlyContinue"',
      `$release = '${release.replace(/'/g, "''")}'`,
      `$hb = '${hb.replace(/'/g, "''")}'`,
      'Remove-Item $release -ErrorAction SilentlyContinue',
      'Remove-Item $hb -ErrorAction SilentlyContinue',
      'Add-Type -Namespace W -Name U -MemberDefinition \'[DllImport("user32.dll")] public static extern bool BlockInput(bool b);\'',
      '$deadline = (Get-Date).AddMinutes($MaxMinutes)',
      'while ((Get-Date) -lt $deadline) {',
      '  [W.U]::BlockInput($true) | Out-Null',
      '  Set-Content -Path $hb -Value (Get-Date -Format o)',
      '  if (Test-Path $release) { break }',
      '  Start-Sleep -Seconds 5',
      '}',
      '[W.U]::BlockInput($false) | Out-Null',
      'Remove-Item $hb -ErrorAction SilentlyContinue',
    ].join('\r\n');
  }

  private spawnLockProc(scriptFile: string): void {
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `"${scriptFile}"`];
    if (this.isAdmin()) {
      this.lockProc = spawn('powershell', args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      this.lockProc.unref();
    } else {
      // 非管理员：通过 RunAs 提权启动（弹出一次 UAC 由家长确认）
      exec(
        `powershell -NoProfile -Command "Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${scriptFile}' -Verb RunAs -WindowStyle Hidden"`,
        () => undefined,
      );
      this.lockProc = null;
    }
  }

  startLock(minutes: number, reason: 'playback' | 'manual' | 'remote'): ChildTvRuntimeStatus {
    const m = Math.min(Math.max(Number(minutes) || this.readSettings().defaultLockMinutes, 1), 1440);
    if (reason === 'playback' && this.lockReason === 'manual') {
      // 已有手动锁，自动锁不覆盖
      return this.getRuntimeStatus();
    }
    const scriptFile = path.join(this.dataDir, LOCK_SCRIPT_FILE);
    fs.writeFileSync(scriptFile, this.lockScript(m), 'utf-8');
    this.removeReleaseFile();
    this.spawnLockProc(scriptFile);
    this.lockReason = reason;
    this.lockEndsAt = new Date(Date.now() + m * 60_000).toISOString();
    if (this.lockTimer) clearTimeout(this.lockTimer);
    this.lockTimer = setTimeout(() => {
      // 兜底：脚本若异常退出，定时解锁
      this.unlock();
    }, m * 60_000 + 30_000);
    const label = reason === 'manual' ? '家长手动' : reason === 'remote' ? '家长远程' : '随播放';
    this.log('info', `${label}锁定电脑（最长 ${m} 分钟）`);
    return this.getRuntimeStatus();
  }

  unlock(): ChildTvRuntimeStatus {
    this.releaseLockFile();
    this.lockReason = null;
    this.lockEndsAt = null;
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
    this.log('info', '已解锁电脑');
    return this.getRuntimeStatus();
  }

  private lockAlive(): boolean {
    const hb = path.join(this.dataDir, LOCK_HEARTBEAT_FILE);
    try {
      if (!fs.existsSync(hb)) return false;
      const mtime = fs.statSync(hb).mtimeMs;
      return Date.now() - mtime < 20_000;
    } catch {
      return false;
    }
  }

  // ==================== 状态 ====================

  getRuntimeStatus(): ChildTvRuntimeStatus {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    // 双机模式：播放状态反映"已下发儿童端"
    const controlled = this.hasControlledClients();
    const playing = controlled ? !!this.syncPlaying.scheduleId : !!this.player;
    const remainingMinutes = playing
      ? Math.max(0, Math.ceil((Date.parse(this.player?.endsAt ?? this.syncPlaying.endsAt ?? now.toISOString()) - Date.now()) / 60_000))
      : null;
    const next = this.nextSchedule(nowMin);
    const mpv = this.detectMpv();
    const locked = this.lockReason !== null || this.lockAlive();
    return {
      playing,
      currentTitle: this.player?.title ?? this.syncPlaying.title ?? '',
      currentScheduleId: this.player?.scheduleId ?? this.syncPlaying.scheduleId ?? null,
      startedAt: this.player?.startedAt ?? null,
      endsAt: this.player?.endsAt ?? this.syncPlaying.endsAt ?? null,
      remainingMinutes,
      manual: this.player?.manual ?? false,
      nextSchedule: next
        ? {
            name: next.s.name,
            startLabel: next.s.start,
            startsInMinutes: next.startsInMinutes,
          }
        : null,
      locked,
      lockReason: this.lockReason,
      lockEndsAt: this.lockEndsAt,
      mpv: playing ? 'running' : mpv ? 'stopped' : 'missing',
      mpvAvailable: !!mpv,
      admin: this.isAdmin(),
      pinEnabled: this.pinEnabledForDefault(),
      lastLog: this.lastLog,
    };
  }

  private pinEnabledForDefault(): boolean {
    const auth = this.readAuth();
    const parent = auth.accounts.find((a) => a.role === 'parent');
    return !!(parent?.pinHash ?? auth.accounts[0]?.pinHash ?? null);
  }

  /** 观看页使用：不暴露控制信息 */
  getWatchStatus(): {
    playing: boolean;
    currentTitle: string;
    remainingMinutes: number | null;
    nextSchedule: ChildTvNextSchedule | null;
    locked: boolean;
    endsAt: string | null;
    pinEnabled: boolean;
  } {
    const s = this.getRuntimeStatus();
    return {
      playing: s.playing,
      currentTitle: s.currentTitle,
      remainingMinutes: s.remainingMinutes,
      nextSchedule: s.nextSchedule,
      locked: s.locked,
      endsAt: s.endsAt,
      pinEnabled: this.pinEnabledForDefault(),
    };
  }

  // ==================== 调度引擎 ====================

  private async tick(): Promise<void> {
    try {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const active = this.schedulesStore
        .findAll()
        .filter((s) => s.enabled && this.inWindow(s, nowMin));

      // 双机模式：家长端只做决策并下发儿童端执行（本机不播放）
      if (this.hasControlledClients()) {
        if (active.length > 0 && this.syncPlaying.scheduleId !== active[0].id) {
          const s = active[0];
          const endsAt = new Date(Date.now() + s.durationMinutes * 60_000).toISOString();
          this.syncPlaying = { scheduleId: s.id, title: s.name, endsAt };
          this.bumpSync();
          this.broadcast({ type: 'play', account: '*', scheduleId: s.id, title: s.name, endsAt });
          this.log('info', `双机模式：到点下发播放「${s.name}」给儿童端`);
          // 播放自动锁（儿童端播放即锁定）
          this.broadcast({ type: 'lock', account: '*', reason: 'playback', minutes: this.readSettings().defaultLockMinutes });
        } else if (active.length === 0 && this.syncPlaying.scheduleId) {
          this.syncPlaying = { scheduleId: null, title: '', endsAt: null };
          this.bumpSync();
          this.broadcast({ type: 'stop', account: '*' });
          this.broadcast({ type: 'unlock', account: '*' });
          this.log('info', '双机模式：时段窗口结束，下发停止');
        }
        return;
      }

      if (active.length > 0 && !this.player) {
        await this.startPlayback(active[0].id, false);
      } else if (active.length === 0 && this.player && !this.player.manual) {
        this.stopPlayback('时段窗口结束');
      }
      // 手动播放超时自动停止
      if (this.player?.manual && Date.now() > Date.parse(this.player.endsAt)) {
        this.stopPlayback('手动播放时长已到');
      }
      // 兜底：播放进程意外退出但 session 未清（mpv crash）
      if (this.player && this.player.proc.exitCode !== null) {
        this.player = null;
      }
    } catch (e) {
      this.log('error', `调度异常：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private finishStats(
    title: string,
    scheduleId: string | null,
    manual: boolean,
    startedAt: Date,
    endedAt: Date,
    reason: string,
  ): void {
    const entry: ChildTvStatsEntry = {
      id: crypto.randomUUID(),
      scheduleId,
      name: title,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationSec: Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)),
      manual,
    };
    this.statsStore.create(entry);
    this.log('info', `播放统计已记录：${title}（${reason}）`);
  }

  // ==================== 双机同步（家长端下发 / 儿童端受控执行） ====================

  /** 校验同步凭证：儿童账号 + 家长端生成的绑定码 */
  private verifySyncCredential(account: string, bind: string): boolean {
    if (!account || !bind) return false;
    const acc = this.findAccount(account);
    return !!acc && acc.role === 'child' && acc.bindCode === bind;
  }

  /** 儿童端轮询同步状态（受控模式每 10 秒拉取，校验绑定码） */
  getSyncState(account: string, bind: string): ChildTvSyncState {
    if (!this.verifySyncCredential(account, bind)) {
      throw new UnauthorizedException('同步凭证无效（账号或绑定码错误）');
    }
    const lock = this.childLocks[account];
    return {
      version: this.syncVersion,
      locked: !!lock,
      lockReason: lock?.reason ?? null,
      lockEndsAt: lock?.endsAt ?? null,
      playingScheduleId: this.syncPlaying.scheduleId,
      playingTitle: this.syncPlaying.title,
      playingEndsAt: this.syncPlaying.endsAt,
      schedules: this.getSchedules(),
      serverTime: new Date().toISOString(),
    };
  }

  /** 家长端 SSE 长连接：儿童端建立后，状态变化实时推送（断线由儿童端重连 + 轮询兜底） */
  streamSyncEvents(account: string, bind: string): Observable<{ data: string }> {
    if (!this.verifySyncCredential(account, bind)) {
      throw new UnauthorizedException('同步凭证无效（账号或绑定码错误）');
    }
    const subject = new Subject<{ data: string }>();
    const conn: SseConnection = { account, subject };
    this.sseClients.push(conn);
    this.log('info', `儿童端「${account}」已连接同步通道`);
    const ping = setInterval(() => subject.next({ data: JSON.stringify({ type: 'ping' }) }), 25_000);
    return new Observable<{ data: string }>((observer) => {
      const sub = subject.subscribe({
        next: (v) => observer.next(v),
        error: (e) => observer.error(e),
        complete: () => observer.complete(),
      });
      // 订阅建立后再推送 init 全量状态（热流在订阅前 next 会丢失，必须在订阅回调内推送）
      observer.next({ data: JSON.stringify({ type: 'init', ...this.getSyncState(account, bind) }) });
      return () => {
        sub.unsubscribe();
        clearInterval(ping);
        this.sseClients = this.sseClients.filter((c) => c !== conn);
        this.log('info', `儿童端「${account}」已断开同步连接`);
      };
    });
  }

  /** 向所有已连接儿童端广播事件（儿童端按账号过滤） */
  private broadcast(evt: ChildTvSyncEvent): void {
    for (const conn of [...this.sseClients]) {
      try {
        conn.subject.next({ data: JSON.stringify(evt) });
      } catch {
        /* 忽略失效连接 */
      }
    }
  }

  // -------- 儿童端受控模式（本机执行端） --------

  /** 受控模式主循环：建立 SSE 长连接实时接收指令，断线自动重连（重连后 init 事件全量校准，无需轮询） */
  private async controlledSyncLoop(): Promise<void> {
    while (this.controlledActive) {
      const settings = this.readSettings();
      const base = (settings.controlled?.parentUrl ?? '').replace(/\/+$/, '');
      const q = `account=${encodeURIComponent(settings.controlled?.childUsername ?? '')}&bind=${encodeURIComponent(settings.controlled?.bindCode ?? '')}`;
      try {
        if (!base) {
          this.log('warn', '受控模式未配置家长端地址');
          await this.sleep(15_000);
          continue;
        }
        // 纯通知驱动：SSE 长连接接收家长端推送（服务端每 25s ping 保活）；
        // 断线后外层循环立即重连，重连建立时服务端推送 init 全量状态校准
        await this.controlledSse(base, q);
      } catch (e) {
        this.log('warn', `受控同步中断：${e instanceof Error ? e.message : String(e)}，3 秒后重连`);
      }
      await this.sleep(SYNC_RECONNECT_MS);
    }
  }

  /** 将家长端状态应用到本机（儿童端执行器） */
  private applyRemoteState(state: ChildTvSyncState): void {
    // 锁定/解锁
    if (state.locked && !this.lockReason) {
      const remaining = state.lockEndsAt
        ? Math.max(1, Math.ceil((Date.parse(state.lockEndsAt) - Date.now()) / 60_000))
        : this.readSettings().defaultLockMinutes;
      this.startLock(remaining, 'remote');
    } else if (!state.locked && (this.lockReason === 'remote' || this.lockReason === 'playback')) {
      this.unlock();
    }
    // 播放/停止（时段表以家长端为准，本机解析资源播放）
    if (state.playingScheduleId && this.player?.scheduleId !== state.playingScheduleId) {
      void this.startPlayback(state.playingScheduleId, false);
    } else if (!state.playingScheduleId && this.player) {
      this.stopPlayback('家长端停止');
    }
    // 时段表同步：家长端为准，儿童端无需手动配置
    if (Array.isArray(state.schedules)) {
      const local = this.schedulesStore.findAll();
      for (const s of state.schedules) {
        const existing = local.find((x) => x.id === s.id);
        if (!existing) this.schedulesStore.create(s);
        else if (JSON.stringify(existing) !== JSON.stringify(s)) this.schedulesStore.update(s.id, s);
      }
    }
  }

  /** SSE 长连接：流式读取家长端推送事件，实时执行 */
  private async controlledSse(base: string, q: string): Promise<void> {
    const res = await fetch(`${base}/api/child-tv/sync/stream?${q}`, {
      headers: { Accept: 'text/event-stream' },
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`SSE HTTP ${res.status}`);
    if (!res.body) throw new Error('SSE 无响应体');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (this.controlledActive) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        this.handleSseChunk(chunk);
      }
    }
  }

  /** 解析单个 SSE 事件并执行（儿童端过滤只属于自己的指令） */
  private handleSseChunk(chunk: string): void {
    const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
    if (!dataLine) return;
    try {
      const evt = JSON.parse(dataLine.slice(5).trim()) as ChildTvSyncEvent;
      const my = this.readSettings().controlled?.childUsername ?? '';
      // init：SSE 建立/重连时服务端推送的全量状态，直接应用（纯通知驱动的重连校准）
      if (evt.type === 'init') {
        this.applyRemoteState(evt as unknown as ChildTvSyncState);
        return;
      }
      if (evt.type === 'ping') return;
      if (evt.account !== my && evt.account !== '*') return;
      this.log('info', `受控指令：${evt.type}${evt.account === '*' ? '（全体）' : ''}`);
      switch (evt.type) {
        case 'lock':
          if (!this.lockReason) {
            this.startLock(evt.minutes ?? this.readSettings().defaultLockMinutes, 'remote');
          }
          break;
        case 'unlock':
          if (this.lockReason === 'remote' || this.lockReason === 'playback') this.unlock();
          break;
        case 'play':
          if (evt.scheduleId && this.player?.scheduleId !== evt.scheduleId) {
            void this.startPlayback(evt.scheduleId, false);
          }
          break;
        case 'stop':
          this.stopPlayback('家长端停止');
          break;
        case 'schedule-change':
          // 家长端时段表变更：收到通知后仅拉取一次全量状态校准（非轮询）
          void this.pullSyncStateOnce();
          break;
        default:
          break;
      }
    } catch {
      /* 忽略无法解析的事件帧 */
    }
  }

  /** 收到通知后拉取一次家长端全量状态并应用（仅事件触发时调用，非轮询） */
  private async pullSyncStateOnce(): Promise<void> {
    const settings = this.readSettings();
    const base = (settings.controlled?.parentUrl ?? '').replace(/\/+$/, '');
    if (!base || !settings.controlled?.childUsername || !settings.controlled?.bindCode) return;
    const q = `account=${encodeURIComponent(settings.controlled.childUsername)}&bind=${encodeURIComponent(settings.controlled.bindCode)}`;
    try {
      const res = await fetch(`${base}/api/child-tv/sync/state?${q}`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return;
      const state = (await res.json()) as ChildTvSyncState;
      this.applyRemoteState(state);
    } catch {
      /* 网络瞬时失败忽略，等下一次通知 */
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ==================== 目录浏览 ====================

  browse(targetPath: string | null | undefined): ChildTvBrowseResult {
    const root: ChildTvBrowseResult = {
      path: null,
      parent: null,
      drives: [],
      dirs: [],
      files: [],
    };
    if (!targetPath) {
      // 列出盘符
      for (let c = 65; c <= 90; c++) {
        const letter = String.fromCharCode(c);
        const p = `${letter}:\\`;
        try {
          if (fs.existsSync(p)) root.drives.push(p);
        } catch { /* ignore */ }
      }
      return root;
    }
    const p = path.resolve(targetPath);
    try {
      if (!fs.existsSync(p)) throw new Error('路径不存在');
      const stat = fs.statSync(p);
      const result: ChildTvBrowseResult = {
        path: p,
        parent: stat.isDirectory() ? path.dirname(p) : path.dirname(path.dirname(p)),
        drives: [],
        dirs: [],
        files: [],
      };
      if (p === path.parse(p).root) result.parent = null;
      if (stat.isDirectory()) {
        for (const e of fs.readdirSync(p, { withFileTypes: true })) {
          if (e.name.startsWith('$')) continue;
          const full = path.join(p, e.name);
          if (e.isDirectory()) result.dirs.push(e.name);
          else if (MEDIA_EXTS.has(path.extname(e.name).toLowerCase())) {
            result.files.push({
              name: e.name,
              path: full,
              kind: VIDEO_EXTS.has(path.extname(e.name).toLowerCase()) ? 'video' : 'audio',
            });
          }
        }
      } else {
        // 传入的是文件：返回其所在目录
        const dir = path.dirname(p);
        result.path = dir;
        result.parent = path.dirname(dir) === dir ? null : path.dirname(dir);
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (e.name.startsWith('$')) continue;
          const full = path.join(dir, e.name);
          if (e.isDirectory()) result.dirs.push(e.name);
          else if (MEDIA_EXTS.has(path.extname(e.name).toLowerCase())) {
            result.files.push({
              name: e.name,
              path: full,
              kind: VIDEO_EXTS.has(path.extname(e.name).toLowerCase()) ? 'video' : 'audio',
            });
          }
        }
      }
      result.dirs.sort((a, b) => a.localeCompare(b, 'zh-CN'));
      result.files.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));
      return result;
    } catch (e) {
      throw new BadRequestException(`无法浏览目录：${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

/** 同步执行命令并返回 stdout（失败返回 null），安全封装 */
function execSyncSafe(cmd: string): string | null {
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    return execSync(cmd, { encoding: 'utf-8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

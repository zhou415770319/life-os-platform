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
import { JsonStore } from '@server/storage/json-store';
import { defaultUrlResolver } from '@server/common/url-resolver';
import type {
  ChildTvAuthInfo,
  ChildTvBrowseResult,
  ChildTvCollection,
  ChildTvCollectionInput,
  ChildTvCollectionItem,
  ChildTvLogEntry,
  ChildTvNextSchedule,
  ChildTvResolveUrlResult,
  ChildTvRuntimeStatus,
  ChildTvSchedule,
  ChildTvScheduleInput,
  ChildTvSettings,
  ChildTvStatsEntry,
} from '@shared/api.interface';

/** 媒体扩展名分类 */
const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.webm', '.m4v', '.ts', '.m2ts']);
const AUDIO_EXTS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.wma']);
const MEDIA_EXTS = new Set([...VIDEO_EXTS, ...AUDIO_EXTS]);

/** 账号（单账号体系：admin 家长账号，密码 sha256 加盐存储） */
interface ChildTvAccount {
  username: string;
  salt: string;
  /** sha256(salt + password) */
  passwordHash: string;
  role: 'parent' | 'child';
  /** 显示名 */
  displayName: string;
  /** 观看页 PIN 哈希（sha256 加盐），null 表示未启用 */
  pinHash: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthFile {
  accounts: ChildTvAccount[];
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

const M3U_FILE = 'child-tv-playlist.m3u';
const SECRET_FILE = 'child-tv-secret.txt';

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
  private readonly collectionsStore = new JsonStore<ChildTvCollection>('child-tv-collections.json', this.dataDir);
  private readonly logsStore = new JsonStore<ChildTvLogEntry>('child-tv-log.json', this.dataDir);
  private readonly statsStore = new JsonStore<ChildTvStatsEntry>('child-tv-stats.json', this.dataDir);

  private authFile = path.join(this.dataDir, 'child-tv-auth.json');
  private settingsFile = path.join(this.dataDir, 'child-tv-settings.json');
  private secret: string;

  /** 登录限流：同 IP 连续失败 5 次锁 15 分钟（公网防爆破） */
  private readonly loginFailures = new Map<string, { fails: number; lockUntil: number }>();
  private static readonly MAX_LOGIN_FAILS = 5;
  private static readonly LOGIN_LOCK_MS = 15 * 60 * 1000;

  private player: PlayerSession | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private lastLog = '';
  private mpvPathCached: string | null | undefined;

  constructor() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.migrateLegacyFiles();
    this.secret = this.loadOrCreateSecret();
    this.ensureAuthFile();
    this.ensureSettingsFile();
    this.ensureSeedSchedules();
    this.migrateLegacySchedules();
  }

  /** 旧版时段（sourceType/source 直接来源）→ 自动迁移为「合集 + 时段绑定合集」 */
  private migrateLegacySchedules(): void {
    const schedules = this.schedulesStore.findAll();
    const legacy = schedules.filter((s) => !s.collectionId);
    if (legacy.length === 0) return;
    for (const s of legacy) {
      const legacyType = s.legacySourceType ?? (s as unknown as { sourceType?: string }).sourceType as 'folder' | 'file' | 'url' | undefined;
      const legacySource = s.legacySource ?? (s as unknown as { source?: string }).source as string | undefined;
      if (legacyType && legacySource) {
        const colId = crypto.randomUUID();
        const col: ChildTvCollection = {
          id: colId,
          name: `${s.name}（自动迁移）`,
          items: [{ id: crypto.randomUUID(), type: legacyType, value: legacySource }],
          createdAt: s.createdAt,
          updatedAt: new Date().toISOString(),
        };
        this.collectionsStore.create(col);
        this.schedulesStore.update(s.id, {
          ...s,
          collectionId: colId,
          weekdays: s.weekdays ?? [],
          legacySourceType: undefined,
          legacySource: undefined,
          updatedAt: new Date().toISOString(),
        });
        this.log('info', `旧时段「${s.name}」已迁移为合集「${col.name}」`);
      } else {
        // 无来源的旧时段：绑定一个空合集占位，避免播放报错
        const colId = crypto.randomUUID();
        const col: ChildTvCollection = {
          id: colId,
          name: `${s.name}（空合集）`,
          items: [],
          createdAt: s.createdAt,
          updatedAt: new Date().toISOString(),
        };
        this.collectionsStore.create(col);
        this.schedulesStore.update(s.id, {
          ...s,
          collectionId: colId,
          weekdays: s.weekdays ?? [],
          updatedAt: new Date().toISOString(),
        });
      }
    }
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

  /** 使用说明文档（家长/儿童均可查看，免登录） */
  getUsageDoc(): { title: string; content: string } {
    const file = path.join(this.dataDir, '使用说明.md');
    try {
      const content = fs.readFileSync(file, 'utf-8');
      return { title: '儿童定时播放・使用说明', content };
    } catch {
      // 文档缺失时返回内置默认说明
      return {
        title: '儿童定时播放・使用说明',
        content: [
          '# 儿童定时播放・使用说明',
          '',
          '家长控制台：进入「儿童定时播放」，可立即播放/停止、管理时段、配置 mpv、查看日志统计。',
          '儿童观看页：访问 `/child-tv`，播放中显示内容名与剩余分钟，无任何操作按钮。',
          '远程控制：服务运行在播放电脑上，家长可在第二台电脑通过浏览器访问本服务地址，登录后即可管理时段与启停播放。',
          '播放时使用 mpv 全屏播放并置顶显示（--fullscreen --ontop）。',
          '详细说明见插件数据目录 `使用说明.md`。',
        ].join('\n'),
      };
    }
  }

  // ==================== 生命周期 ====================

  onModuleInit(): void {
    this.log('info', '儿童定时播放服务启动');
    // 单机调度：服务运行在的电脑即播放电脑，定时到点本机 mpv 全屏播放
    this.tickTimer = setInterval(() => void this.tick(), 15_000);
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.stopPlayback('服务停止');
    this.log('info', '儿童定时播放服务停止');
  }

  /** 插件被暂停时调用：停止调度器与正在进行的播放（由插件中心「暂停」触发） */
  async onPluginSuspended(): Promise<void> {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.stopPlayback('插件已暂停');
    this.log('warn', '插件已暂停：定时调度与播放已停止');
  }

  /** 插件被恢复时调用：重新启动调度器（由插件中心「启用」触发） */
  async onPluginResumed(): Promise<void> {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => void this.tick(), 15_000);
    void this.tick();
    this.log('info', '插件已恢复：定时调度已重启');
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
      // 安全：默认密码改为随机生成（8 位十六进制），不再使用固定 123456
      const defaultPassword = crypto.randomBytes(4).toString('hex');
      const now = new Date().toISOString();
      this.writeAuth({
        accounts: [
          {
            username: 'admin',
            salt,
            passwordHash: this.hash(salt, defaultPassword),
            role: 'parent',
            displayName: '管理员',
            pinHash: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
        updatedAt: now,
      });
      this.log('warn', `已创建默认家长账号 admin，初始密码：${defaultPassword}（首次登录后请立即修改）`);
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
            createdAt: legacy.updatedAt ?? now,
            updatedAt: now,
          },
        ],
        updatedAt: now,
      });
      this.log('info', `已迁移旧版单账号 → 多账号体系（${legacy.username ?? 'admin'} 为家长账号）`);
    }
    // 启动检测：仍在使用默认密码 123456 的账号给出安全警告
    const auth = this.readAuth();
    for (const acc of auth.accounts) {
      if (this.hash(acc.salt, '123456') === acc.passwordHash) {
        this.log(
          'warn',
          `账号「${acc.username}」仍在使用默认密码 123456，公网部署存在风险，请立即在控制台修改密码`,
        );
      }
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
      immediatePlayDurationMinutes: 120,
      mpvPath: '',
    };
  }

  readSettings(): ChildTvSettings {
    return {
      ...this.defaultSettings(),
      ...this.readJson<Partial<ChildTvSettings>>(this.settingsFile, {}),
    };
  }

  private writeSettings(s: ChildTvSettings): void {
    this.writeJson(this.settingsFile, s);
  }

  private ensureSeedSchedules(): void {
    if (this.schedulesStore.findAll().length > 0) return;
    const now = new Date().toISOString();
    const seedCollections: ChildTvCollection[] = [
      { id: crypto.randomUUID(), name: '纪录片', items: [], createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), name: '英语', items: [], createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), name: '喜马拉雅', items: [], createdAt: now, updatedAt: now },
    ];
    const colIds = seedCollections.map((c) => c.id);
    for (const c of seedCollections) this.collectionsStore.create(c);
    const seeds: ChildTvSchedule[] = [
      {
        id: crypto.randomUUID(),
        name: '纪录片',
        weekdays: [],
        start: '06:00',
        durationMinutes: 60,
        collectionId: colIds[0],
        mediaType: 'video',
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: '英语',
        weekdays: [],
        start: '07:30',
        durationMinutes: 30,
        collectionId: colIds[1],
        mediaType: 'video',
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        name: '喜马拉雅',
        weekdays: [],
        start: '20:00',
        durationMinutes: 60,
        collectionId: colIds[2],
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

  async login(
    username: string,
    password: string,
    ipKey?: string,
  ): Promise<{
    token: string;
    username: string;
    role: 'parent' | 'child';
    displayName: string;
  }> {
    this.checkLoginRateLimit(ipKey ?? 'unknown');
    const account = this.findAccount(username);
    if (!account || this.hash(account.salt, password ?? '') !== account.passwordHash) {
      this.recordLoginFailure(ipKey ?? 'unknown');
      throw new UnauthorizedException('用户名或密码错误');
    }
    this.clearLoginFailure(ipKey ?? 'unknown');
    return {
      token: this.issueToken(account),
      username: account.username,
      role: account.role,
      displayName: account.displayName,
    };
  }

  private checkLoginRateLimit(ipKey: string): void {
    const entry = this.loginFailures.get(ipKey);
    if (entry && entry.lockUntil > Date.now()) {
      throw new UnauthorizedException('尝试次数过多，请 15 分钟后再试');
    }
  }

  private recordLoginFailure(ipKey: string): void {
    const entry = this.loginFailures.get(ipKey) ?? { fails: 0, lockUntil: 0 };
    entry.fails += 1;
    if (entry.fails >= ChildTvService.MAX_LOGIN_FAILS) {
      entry.lockUntil = Date.now() + ChildTvService.LOGIN_LOCK_MS;
      entry.fails = 0;
    }
    this.loginFailures.set(ipKey, entry);
  }

  private clearLoginFailure(ipKey: string): void {
    this.loginFailures.delete(ipKey);
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

  // ==================== 设置 ====================

  async updateSettings(patch: Partial<ChildTvSettings>): Promise<ChildTvSettings> {
    const cur = this.readSettings();
    const next: ChildTvSettings = {
      ...cur,
      ...patch,
      pinHash: cur.pinHash, // PIN 由 updateAccount 管理
    };
    this.writeSettings(next);
    this.mpvPathCached = undefined; // mpv 路径可能已变更，强制下次重检
    return next;
  }

  // ==================== 合集 ====================

  getCollections(): ChildTvCollection[] {
    return this.collectionsStore
      .findAll()
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }

  getCollection(id: string): ChildTvCollection {
    const col = this.collectionsStore.findAll().find((c) => c.id === id);
    if (!col) throw new NotFoundException('合集不存在');
    return col;
  }

  createCollection(dto: ChildTvCollectionInput): ChildTvCollection {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('合集名称不能为空');
    if (this.collectionsStore.findAll().some((c) => c.name === name)) {
      throw new BadRequestException(`合集「${name}」已存在`);
    }
    const now = new Date().toISOString();
    const row: ChildTvCollection = {
      id: crypto.randomUUID(),
      name,
      items: this.normalizeItems(dto.items ?? []),
      createdAt: now,
      updatedAt: now,
    };
    this.collectionsStore.create(row);
    this.log('info', `新增合集「${name}」（${row.items.length} 个条目）`);
    return row;
  }

  updateCollection(id: string, dto: Partial<ChildTvCollectionInput>): ChildTvCollection {
    const existing = this.collectionsStore.findAll().find((c) => c.id === id);
    if (!existing) throw new NotFoundException('合集不存在');
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('合集名称不能为空');
      if (this.collectionsStore.findAll().some((c) => c.id !== id && c.name === name)) {
        throw new BadRequestException(`合集「${name}」已存在`);
      }
      existing.name = name;
    }
    if (dto.items !== undefined) existing.items = this.normalizeItems(dto.items);
    const updated = this.collectionsStore.update(id, {
      ...existing,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) throw new NotFoundException('合集不存在');
    this.log('info', `修改合集「${updated.name}」（${updated.items.length} 个条目）`);
    return updated;
  }

  deleteCollection(id: string, force = false): { success: boolean; detachedSchedules?: string[] } {
    const usedBy = this.schedulesStore.findAll().filter((s) => s.collectionId === id);
    if (usedBy.length > 0 && !force) {
      throw new BadRequestException(
        `合集仍被时段使用（${usedBy.map((s) => s.name).join('、')}），请先解除绑定`,
      );
    }
    // force：解除这些时段的合集引用（时段保留，变为未选合集）再删除合集
    const detached: string[] = [];
    for (const s of usedBy) {
      this.schedulesStore.update(s.id, { collectionId: undefined, updatedAt: new Date().toISOString() });
      detached.push(s.name);
    }
    const removed = this.collectionsStore.remove(id);
    if (!removed) throw new NotFoundException('合集不存在');
    this.log(
      'info',
      `删除合集「${removed.name}」${detached.length ? `，已解除时段绑定：${detached.join('、')}` : ''}`,
    );
    return { success: true, detachedSchedules: detached };
  }

  /** 条目规范化：补齐 id、去空 */
  private normalizeItems(items: ChildTvCollectionItem[]): ChildTvCollectionItem[] {
    return items
      .filter((i) => i?.value?.trim())
      .map((i) => ({
        id: i.id || crypto.randomUUID(),
        type: i.type,
        value: i.value.trim(),
        title: i.title?.trim() || undefined,
        expandedUrls: i.expandedUrls ?? undefined,
      }));
  }

  /** 解析 URL：直链直接返回；疑似合集页抓取并提取视频地址列表 */
  async resolveCollectionUrl(url: string): Promise<ChildTvResolveUrlResult> {
    const u = url?.trim();
    if (!u) throw new BadRequestException('URL 不能为空');
    if (!/^https?:\/\//i.test(u)) throw new BadRequestException('URL 需以 http:// 或 https:// 开头');
    return this.expandUrl(u);
  }

  private async expandUrl(url: string): Promise<ChildTvResolveUrlResult> {
    // 1. 直链判断（媒体扩展名 / m3u8 / CDN 签名直链：抖音等 URL 无扩展名但带 mime_type 参数）
    const pathOnly = url.split(/[?#]/)[0];
    const ext = path.extname(pathOnly).toLowerCase();
    const isCdnDirect = /mime_type=video_(mp4|m3u8)/i.test(url);
    if (MEDIA_EXTS.has(ext) || ext === '.m3u8' || isCdnDirect) {
      return { isDirect: true, urls: [url], items: [{ url }], platform: 'direct' };
    }
    // 2. 公共链接解析器：按平台识别 → 平台 provider 解析（抖音/抖音精选/B 站/喜马拉雅/通用兜底）
    try {
      const r = await defaultUrlResolver.resolve(url);
      const items = r.items.map((it) => ({ title: it.title, url: it.url }));
      return {
        isDirect: r.isDirect,
        urls: items.map((it) => it.url),
        items,
        platform: r.platform,
        error: r.error,
      };
    } catch (e) {
      return {
        isDirect: false,
        urls: [url],
        error: `解析失败（${e instanceof Error ? e.message : String(e)}），将按单个地址尝试播放`,
      };
    }
  }

  // ==================== 时段 ====================

  getSchedules(): ChildTvSchedule[] {
    const cols = this.collectionsStore.findAll();
    return this.schedulesStore
      .findAll()
      .map((s) => ({
        ...s,
        collectionName: cols.find((c) => c.id === s.collectionId)?.name ?? '（已删除合集）',
      }))
      .sort((a, b) => {
        const d = (a.weekdays?.length ? a.weekdays[0] : 0) - (b.weekdays?.length ? b.weekdays[0] : 0);
        if (d !== 0) return d;
        return a.start < b.start ? -1 : 1;
      });
  }

  private validateScheduleInput(dto: ChildTvScheduleInput): void {
    if (!dto.name?.trim()) throw new BadRequestException('时段名称不能为空');
    if (!Array.isArray(dto.weekdays) || dto.weekdays.some((w) => !Number.isInteger(w) || w < 1 || w > 7)) {
      throw new BadRequestException('星期设置不合法（1=周一 … 7=周日，空=每天）');
    }
    if (!/^\d{2}:\d{2}$/.test(dto.start || '')) throw new BadRequestException('开始时间格式应为 HH:MM');
    const [h, m] = dto.start.split(':').map(Number);
    if (h > 23 || m > 59) throw new BadRequestException('开始时间不合法');
    const dur = Number(dto.durationMinutes);
    if (!Number.isFinite(dur) || dur < 1 || dur > 1440) {
      throw new BadRequestException('时长需在 1-1440 分钟之间');
    }
    if (!dto.collectionId?.trim()) throw new BadRequestException('请选择播放合集');
    if (!this.collectionsStore.findAll().some((c) => c.id === dto.collectionId)) {
      throw new BadRequestException('所选合集不存在');
    }
    if (!['video', 'audio'].includes(dto.mediaType)) {
      throw new BadRequestException('类型需为视频或音频');
    }
  }

  createSchedule(dto: ChildTvScheduleInput): ChildTvSchedule {
    this.validateScheduleInput(dto);
    this.checkScheduleConflict(dto.weekdays ?? [], dto.start, Number(dto.durationMinutes), null);
    const now = new Date().toISOString();
    const row: ChildTvSchedule = {
      id: crypto.randomUUID(),
      name: dto.name.trim(),
      weekdays: dto.weekdays ?? [],
      start: dto.start,
      durationMinutes: Number(dto.durationMinutes),
      collectionId: dto.collectionId,
      mediaType: dto.mediaType,
      enabled: dto.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.schedulesStore.create(row);
    this.log(
      'info',
      `新增时段「${row.name}」${row.weekdays.length ? `周${row.weekdays.join(',')} ` : '每天 '}${row.start} 起 ${row.durationMinutes} 分钟`,
    );
    return row;
  }

  updateSchedule(id: string, dto: Partial<ChildTvScheduleInput>): ChildTvSchedule {
    const existing = this.schedulesStore.findAll().find((s) => s.id === id);
    if (!existing) throw new NotFoundException('时段不存在');
    const next = { ...existing, ...dto, id: existing.id };
    this.validateScheduleInput(next as ChildTvScheduleInput);
    this.checkScheduleConflict(next.weekdays ?? [], next.start, Number(next.durationMinutes), id);
    const updated = this.schedulesStore.update(id, {
      ...next,
      legacySourceType: undefined,
      legacySource: undefined,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) throw new NotFoundException('时段不存在');
    this.log('info', `修改时段「${updated.name}」`);
    return updated;
  }

  deleteSchedule(id: string): { success: boolean } {
    const removed = this.schedulesStore.remove(id);
    if (!removed) throw new NotFoundException('时段不存在');
    this.log('info', `删除时段「${removed.name}」`);
    return { success: true };
  }

  /** 星期交集：两者有共同星期或任一为"每天" */
  private weekdaysOverlap(a: number[], b: number[]): boolean {
    const an = a?.length ? a : [1, 2, 3, 4, 5, 6, 7];
    const bn = b?.length ? b : [1, 2, 3, 4, 5, 6, 7];
    return an.some((w) => bn.includes(w));
  }

  /** 时段冲突检测：星期有交集且时间重叠 → 冲突 */
  private checkScheduleConflict(weekdays: number[], start: string, durationMinutes: number, excludeId: string | null): void {
    const [h, m] = start.split(':').map(Number);
    const startMin = h * 60 + m;
    const endMin = startMin + durationMinutes;
    const schedules = this.schedulesStore.findAll().filter((s) => s.id !== excludeId && s.enabled);
    for (const s of schedules) {
      if (!this.weekdaysOverlap(weekdays, s.weekdays ?? [])) continue;
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

  /** JS 星期（0=周日）→ 本系统星期（1=周一 … 7=周日） */
  private todayWeekday(): number {
    const js = new Date().getDay();
    return js === 0 ? 7 : js;
  }

  /** 时段是否适用于今天 */
  private appliesToday(s: ChildTvSchedule): boolean {
    return !(s.weekdays?.length) || s.weekdays.includes(this.todayWeekday());
  }

  /** 当前分钟是否处于时段窗口内（支持跨天 + 星期匹配） */
  private inWindow(s: ChildTvSchedule, nowMin: number): boolean {
    if (!this.appliesToday(s)) return false;
    const [h, m] = s.start.split(':').map(Number);
    const startMin = h * 60 + m;
    const endMin = startMin + s.durationMinutes;
    return this.rangesOverlap(nowMin, nowMin + 1, startMin, endMin);
  }

  private nextSchedule(nowMin: number): { s: ChildTvSchedule; startsInMinutes: number } | null {
    const schedules = this.schedulesStore.findAll().filter((s) => s.enabled);
    let best: { s: ChildTvSchedule; startsInMinutes: number } | null = null;
    for (const s of schedules) {
      if (!this.appliesToday(s)) continue;
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

  /** 按合集展开播放列表：folder 递归扫描按文件名排序、file 单文件、url 直链/合集解析 */
  private async resolveCollectionPlaylist(collection: ChildTvCollection): Promise<{ entries: Array<{ title: string; target: string }>; skipped: string[] }> {
    const entries: Array<{ title: string; target: string }> = [];
    const skipped: string[] = [];
    for (const item of collection.items) {
      if (item.type === 'folder') {
        if (!fs.existsSync(item.value) || !fs.statSync(item.value).isDirectory()) {
          skipped.push(`${item.value}（文件夹不存在）`);
          continue;
        }
        const files: string[] = [];
        const walk = (dir: string): void => {
          let ents: fs.Dirent[] = [];
          try {
            ents = fs.readdirSync(dir, { withFileTypes: true });
          } catch {
            return;
          }
          for (const e of ents) {
            if (e.name.startsWith('.')) continue;
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (MEDIA_EXTS.has(path.extname(e.name).toLowerCase())) files.push(full);
          }
        };
        walk(item.value);
        files.sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
        if (files.length === 0) {
          skipped.push(`${item.value}（无音视频文件）`);
          continue;
        }
        for (const f of files) {
          entries.push({ title: path.basename(f), target: f });
        }
      } else if (item.type === 'file') {
        if (!fs.existsSync(item.value)) {
          skipped.push(`${item.value}（文件不存在）`);
          continue;
        }
        entries.push({ title: item.title || path.basename(item.value), target: item.value });
      } else if (item.type === 'url') {
        // URL：尝试解析（直链 or 合集页展开）；解析失败仍保留原地址尝试播放
        // 解析结果带标题（视频名）时用标题命名播放条目，m3u 显示视频名称；
        // 直链等无标题的解析结果，回退使用条目保存的名称（item.title）
        let urls: { url: string; title?: string }[] = [{ url: item.value, title: item.title }];
        try {
          const r = await this.expandUrl(item.value);
          if (r.items?.length) {
            urls = r.items.map((it) => ({ url: it.url, title: it.title || item.title }));
          } else if (r.urls?.length) {
            urls = r.urls.map((u) => ({ url: u, title: item.title }));
          }
          if (!r.isDirect && r.error && r.urls.length === 1) skipped.push(`${item.value}（${r.error}）`);
        } catch {
          urls = [{ url: item.value, title: item.title }];
        }
        for (const u of urls) {
          entries.push({ title: u.title || u.url, target: u.url });
        }
      }
    }
    return { entries, skipped };
  }

  /** 解析时段播放资源（按合集生成 m3u 循环播放列表） */
  private async resolveResource(s: ChildTvSchedule): Promise<{ title: string; args: string[] }> {
    const collection = this.collectionsStore.findAll().find((c) => c.id === s.collectionId);
    if (!collection) throw new BadRequestException(`时段「${s.name}」关联的合集不存在，请重新选择合集`);
    const { entries, skipped } = await this.resolveCollectionPlaylist(collection);
    if (entries.length === 0) {
      throw new BadRequestException(
        `合集「${collection.name}」没有可播放内容${skipped.length ? `（${skipped.join('；')}）` : ''}，请先添加文件夹/文件/URL`,
      );
    }
    if (skipped.length > 0) {
      this.log('warn', `合集「${collection.name}」部分条目跳过：${skipped.join('；')}`);
    }
    const m3u = path.join(this.dataDir, M3U_FILE);
    fs.writeFileSync(
      m3u,
      entries.map((e) => `#EXTINF:0,${e.title}\n${e.target}`).join('\n'),
      'utf-8',
    );
    // B 站解析出的直链（upos/bilivideo CDN）播放时必须带 Referer，否则返回 403
    const args: string[] = [m3u, '--loop-playlist=inf'];
    if (entries.some((e) => /bilivideo\.com|bilibili\.com/i.test(e.target))) {
      args.push('--http-header-fields=Referer:https://www.bilibili.com');
    }
    return {
      title: `${collection.name}（${entries.length} 项）`,
      args,
    };
  }

  private buildMpvArgs(s: ChildTvSchedule, args: string[]): string[] {
    const common = [
      '--fullscreen',
      '--ontop', // 全屏 + 屏幕最上层（不锁键，孩子能看也能操作）
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
      resolved = await this.resolveResource(schedule);
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
    this.log('info', `${manual ? '家长手动' : '定时'}播放开始「${resolved.title}」${schedule.mediaType === 'audio' ? '(音频)' : '(视频)'}`);
    return this.getRuntimeStatus();
  }

  stopPlayback(reason: string): { success: boolean } {
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
    }
    return { success: true };
  }

  /** 手动立即播放指定时段（本机 mpv 播放） */
  async playNow(scheduleId: string): Promise<ChildTvRuntimeStatus> {
    return this.startPlayback(scheduleId, true);
  }

  // ==================== 状态 ====================

  getRuntimeStatus(): ChildTvRuntimeStatus {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const playing = !!this.player;
    const remainingMinutes = playing
      ? Math.max(0, Math.ceil((Date.parse(this.player?.endsAt ?? now.toISOString()) - Date.now()) / 60_000))
      : null;
    const next = this.nextSchedule(nowMin);
    const mpv = this.detectMpv();
    return {
      playing,
      currentTitle: this.player?.title ?? '',
      currentScheduleId: this.player?.scheduleId ?? null,
      startedAt: this.player?.startedAt ?? null,
      endsAt: this.player?.endsAt ?? null,
      remainingMinutes,
      manual: this.player?.manual ?? false,
      nextSchedule: next
        ? {
            name: next.s.name,
            startLabel: next.s.start,
            startsInMinutes: next.startsInMinutes,
          }
        : null,
      mpv: playing ? 'running' : mpv ? 'stopped' : 'missing',
      mpvAvailable: !!mpv,
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
    endsAt: string | null;
    pinEnabled: boolean;
  } {
    const s = this.getRuntimeStatus();
    return {
      playing: s.playing,
      currentTitle: s.currentTitle,
      remainingMinutes: s.remainingMinutes,
      nextSchedule: s.nextSchedule,
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

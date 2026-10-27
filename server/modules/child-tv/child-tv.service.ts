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
import { exec, spawn, execSync, ChildProcess } from 'child_process';
import * as net from 'net';
import * as iconv from 'iconv-lite';
import { JsonStore } from '@server/storage/json-store';
import { defaultUrlResolver } from '@server/common/url-resolver';
import type {
  ChildTvAuthInfo,
  ChildTvBatchCreateResult,
  ChildTvBatchDeleteResult,
  ChildTvBatchPreviewResult,
  ChildTvBrowseResult,
  ChildTvCollection,
  ChildTvCollectionInput,
  ChildTvCollectionItem,
  ChildTvCollectionProgressInfo,
  ChildTvLogEntry,
  ChildTvNextSchedule,
  ChildTvResolveUrlResult,
  ChildTvRuntimeStatus,
  ChildTvSchedule,
  ChildTvScheduleInput,
  ChildTvScanResult,
  ChildTvSettings,
  ChildTvStatsEntry,
} from '@shared/api.interface';

/** 媒体扩展名分类 */
const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.webm', '.m4v', '.ts', '.m2ts']);
const AUDIO_EXTS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.wma']);
/** 喜马拉雅客户端私有音频格式：用喜马拉雅客户端打开播放（关联命令 喜马拉雅.exe "%1"） */
const XIMALAYA_EXTS = new Set(['.xm']);
const MEDIA_EXTS = new Set([...VIDEO_EXTS, ...AUDIO_EXTS, ...XIMALAYA_EXTS]);

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

/** 喜马拉雅浏览器辅助解析的暂存条目（token → 待解析列表 + 已回传直链） */
interface XimalayaPendingEntry {
  trackIds: { id: string; title: string }[];
  collected: { id: string; title?: string; url: string }[];
  createdAt: number;
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
  /** 当前播放的合集 id（用于记录/恢复播放进度） */
  collectionId: string | null;
  /** mpv IPC 通道（Windows 命名管道 / unix socket） */
  ipcPath: string | null;
  /** 是否已因音频设备不可用降级为静音播放（--ao=null） */
  audioFallback: boolean;
  /** mpv 播放列表第 i 项在合集完整条目列表中的索引（playlist-pos → 完整列表索引映射，混合 xm/mpv 合集用） */
  mpvToFull: number[] | null;
  /** 完整条目列表按 fullIndex 的时长（秒，本地文件探测；未知为 null） */
  durations: (number | null)[] | null;
  /** 完整条目列表按 fullIndex 的标题（控制台展示"当前播放的内容"） */
  entryTitles: string[] | null;
}

/** 合集播放进度：记录上次播放到的条目索引（0-based）及条目内位置（秒），下次播放该合集时从进度处继续 */
interface ChildTvCollectionProgress {
  id: string;
  collectionId: string;
  entryIndex: number;
  /** 条目内播放位置（秒，mpv 本地播放时记录；外部播放无此值） */
  position?: number;
  updatedAt: string;
}

/**
 * 外部播放会话：
 * - web：浏览器打开页面播放（platform=web 合集）
 * - ximalaya：喜马拉雅客户端 + 浏览器兜底（platform=ximalaya 合集）
 * - ximalaya-local：喜马拉雅客户端打开本地 .xm 文件（local 合集中的 xm 条目）
 * 不经过 mpv，仅用于状态展示、到时停止与统计；ximalaya-local 会记录"播到第几集"进度
 */
interface ExternalPlaySession {
  type: 'web' | 'ximalaya' | 'ximalaya-local';
  title: string;
  /** web/ximalaya 为页面 URL；ximalaya-local 为本地 .xm 文件路径 */
  pageUrl: string;
  startedAt: string;
  endsAt: string;
  manual: boolean;
  collectionId: string;
  /** ximalaya-local：合集 xm 条目列表（窗口标题 → 条目匹配，用于同步播放进度） */
  entries?: Array<{ title: string; path: string; fullIndex: number }>;
  /** ximalaya-local：当前已记录的条目索引 */
  entryIndex?: number;
}

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
  /** 合集播放进度（entryIndex：上次播放到的条目索引，0-based；position：条目内位置秒） */
  private readonly progressStore = new JsonStore<ChildTvCollectionProgress>('child-tv-progress.json', this.dataDir);
  /** 本地媒体文件时长缓存（path → 秒，跨合集共享，避免重复探测） */
  private readonly fileDurationStore = new JsonStore<{ id: string; path: string; duration: number }>('child-tv-file-durations.json', this.dataDir);

  private authFile = path.join(this.dataDir, 'child-tv-auth.json');
  private settingsFile = path.join(this.dataDir, 'child-tv-settings.json');
  private secret: string;

  /** 登录限流：同 IP 连续失败 5 次锁 15 分钟（公网防爆破） */
  private readonly loginFailures = new Map<string, { fails: number; lockUntil: number }>();
  private static readonly MAX_LOGIN_FAILS = 5;
  private static readonly LOGIN_LOCK_MS = 15 * 60 * 1000;

  private player: PlayerSession | null = null;
  /** 外部播放会话（web/ximalaya 合集，不使用 mpv） */
  private externalPlay: ExternalPlaySession | null = null;
  /** 喜马拉雅 .xm 本地文件连播：自动切下一集的定时器 */
  private xmPlayTimer: NodeJS.Timeout | null = null;
  /** 喜马拉雅 .xm 本地文件连播：标题轮询检测播放结束 */
  private xmTitlePollTimer: NodeJS.Timeout | null = null;
  private xmPolling = false;
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
    void this.stopPlayback('服务停止');
    this.log('info', '儿童定时播放服务停止');
  }

  /** 插件被暂停时调用：停止调度器与正在进行的播放（由插件中心「暂停」触发） */
  async onPluginSuspended(): Promise<void> {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    void this.stopPlayback('插件已暂停');
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
      ximalayaCookie: '',
      ximalayaTrackDurationMinutes: 15,
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
    const cols = this.collectionsStore.findAll().sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    // 后台探测未记时长的本地文件条目（不阻塞返回；探测结果写入合集 items.duration，下次请求即带出）
    for (const col of cols) {
      const missing = col.items.filter((it) => it.type === 'file' && !it.duration && fs.existsSync(it.value));
      if (missing.length > 0) void this.probeCollectionFileDurations(col.id, missing.map((it) => it.value));
    }
    return cols;
  }

  /** 后台探测合集内本地文件条目时长并写回合集（供列表展示总时长） */
  private async probeCollectionFileDurations(collectionId: string, files: string[]): Promise<void> {
    try {
      const col = this.collectionsStore.findAll().find((c) => c.id === collectionId);
      if (!col) return;
      const probed = await this.probeEntriesDurations(
        files.map((f, i) => ({ fullIndex: i, path: f })),
      );
      if (probed.size === 0) return;
      let changed = false;
      const items = col.items.map((it) => {
        if (it.type !== 'file' || it.duration) return it;
        const c = this.fileDurationStore.findAll().find((r) => r.path === it.value);
        if (c && c.duration > 0) {
          changed = true;
          return { ...it, duration: c.duration };
        }
        return it;
      });
      if (changed) this.collectionsStore.update(col.id, { items, updatedAt: new Date().toISOString() });
    } catch { /* 后台探测失败不影响列表 */ }
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
      platform: dto.platform ?? 'local',
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
    if (dto.platform !== undefined) existing.platform = dto.platform;
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
    // 清理该合集的播放进度记录，避免孤儿数据
    for (const p of this.progressStore.findAll().filter((x) => x.collectionId === id)) {
      this.progressStore.remove(p.id);
    }
    this.log(
      'info',
      `删除合集「${removed.name}」${detached.length ? `，已解除时段绑定：${detached.join('、')}` : ''}`,
    );
    return { success: true, detachedSchedules: detached };
  }

  /** 递归收集目录下全部音视频文件（含 .xm），按文件名自然排序；不存在的目录返回空数组 */
  private collectMediaFiles(dir: string): string[] {
    const files: string[] = [];
    const walk = (d: string): void => {
      let ents: fs.Dirent[] = [];
      try {
        ents = fs.readdirSync(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of ents) {
        if (e.name.startsWith('.') || e.name.startsWith('$')) continue;
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else if (MEDIA_EXTS.has(path.extname(e.name).toLowerCase())) files.push(full);
      }
    };
    walk(dir);
    files.sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
    return files;
  }

  /** 扫描父文件夹下的一级子文件夹，收集每个子文件夹内的音视频文件（重名判断由调用方处理） */
  private scanBatchCreateCandidates(folder: string): Array<{ name: string; files: string[] }> {
    const p = path.resolve(folder?.trim() || '');
    if (!p) throw new BadRequestException('请选择父文件夹');
    if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
      throw new BadRequestException('文件夹不存在或不是目录');
    }
    let subDirs: string[] = [];
    try {
      subDirs = fs
        .readdirSync(p, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('$'))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
    } catch {
      throw new BadRequestException('无法读取文件夹');
    }
    if (subDirs.length === 0) throw new BadRequestException('该文件夹下没有子文件夹');
    return subDirs.map((name) => ({ name, files: this.collectMediaFiles(path.join(p, name)) }));
  }

  /** 批量创建前的预览：扫描对比，返回将新建与跳过（已存在/无媒体）的明细，不写库 */
  previewBatchCreateFromFolder(folder: string): ChildTvBatchPreviewResult {
    const candidates = this.scanBatchCreateCandidates(folder);
    const existingNames = new Set(this.collectionsStore.findAll().map((c) => c.name));
    const toCreate: Array<{ name: string; count: number }> = [];
    const skipped: Array<{ name: string; reason: string }> = [];
    for (const c of candidates) {
      if (existingNames.has(c.name)) {
        skipped.push({ name: c.name, reason: '已存在同名合集' });
        continue;
      }
      if (c.files.length === 0) {
        skipped.push({ name: c.name, reason: '没有音视频文件' });
        continue;
      }
      toCreate.push({ name: c.name, count: c.files.length });
    }
    return { toCreate, skipped };
  }

  /** 批量创建合集：父文件夹下每个一级子文件夹 = 一个合集，子文件夹内音视频为资源 */
  batchCreateCollectionsFromFolder(folder: string): ChildTvBatchCreateResult {
    const candidates = this.scanBatchCreateCandidates(folder);
    const existingNames = new Set(this.collectionsStore.findAll().map((c) => c.name));
    const created: ChildTvCollection[] = [];
    const skipped: Array<{ name: string; reason: string }> = [];
    for (const c of candidates) {
      if (existingNames.has(c.name)) {
        skipped.push({ name: c.name, reason: '已存在同名合集' });
        continue;
      }
      if (c.files.length === 0) {
        skipped.push({ name: c.name, reason: '没有音视频文件' });
        continue;
      }
      const now = new Date().toISOString();
      const row: ChildTvCollection = {
        id: crypto.randomUUID(),
        name: c.name,
        platform: 'local',
        items: c.files.map((f) => ({
          id: crypto.randomUUID(),
          type: 'file',
          value: f,
          title: path.basename(f),
        })),
        createdAt: now,
        updatedAt: now,
      };
      this.collectionsStore.create(row);
      existingNames.add(c.name);
      created.push(row);
      this.log('info', `批量创建合集「${c.name}」（${row.items.length} 个条目）`);
    }
    if (created.length === 0 && skipped.length === 0) {
      throw new BadRequestException('该文件夹下没有子文件夹');
    }
    return { created, skipped };
  }

  /** 批量删除合集：被时段引用时自动解绑（force），进度记录一并清理 */
  batchDeleteCollections(ids: string[]): ChildTvBatchDeleteResult {
    const idList = Array.isArray(ids) ? ids.filter((i) => typeof i === 'string' && i.trim()) : [];
    if (idList.length === 0) throw new BadRequestException('请选择要删除的合集');
    const detachedSchedules: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];
    let deleted = 0;
    for (const id of idList) {
      try {
        const r = this.deleteCollection(id, true);
        deleted += 1;
        if (r.detachedSchedules?.length) detachedSchedules.push(...r.detachedSchedules);
      } catch (e) {
        failed.push({ id, reason: e instanceof Error ? e.message : String(e) });
      }
    }
    if (deleted === 0) throw new BadRequestException('删除失败：' + failed.map((f) => f.reason).join('；'));
    return { deleted, detachedSchedules, failed };
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

  /** 解析 URL：直链直接返回；疑似合集页抓取并提取视频地址列表。cookie 为调用方临时补充的登录态（成功后存入设置复用） */
  async resolveCollectionUrl(url: string, cookie?: string): Promise<ChildTvResolveUrlResult> {
    const u = url?.trim();
    if (!u) throw new BadRequestException('URL 不能为空');
    if (!/^https?:\/\//i.test(u)) throw new BadRequestException('URL 需以 http:// 或 https:// 开头');
    return this.expandUrl(u, cookie);
  }

  private async expandUrl(url: string, cookie?: string): Promise<ChildTvResolveUrlResult> {
    // 1. 直链判断（媒体扩展名 / m3u8 / CDN 签名直链：抖音等 URL 无扩展名但带 mime_type 参数）
    const pathOnly = url.split(/[?#]/)[0];
    const ext = path.extname(pathOnly).toLowerCase();
    const isCdnDirect = /mime_type=video_(mp4|m3u8)/i.test(url);
    if (MEDIA_EXTS.has(ext) || ext === '.m3u8' || isCdnDirect) {
      return { isDirect: true, urls: [url], items: [{ url }], platform: 'direct' };
    }
    // 2. 公共链接解析器：按平台识别 → 平台 provider 解析（抖音/抖音精选/B 站/喜马拉雅/通用兜底）
    //    平台需要 Cookie 时：先用设置里已保存的 Cookie，调用方临时传入的 Cookie 优先
    const savedCookie = this.readSettings().ximalayaCookie;
    const useCookie = (cookie?.trim() || savedCookie) || undefined;
    try {
      const r = await defaultUrlResolver.resolve(url, useCookie ? { cookie: useCookie } : undefined);
      // 平台需要补充条件 → 透出 requires 提示
      if (r.requires) {
        if (r.requires.kind === 'browser') {
          // 浏览器辅助模式：生成一次性 token 并暂存待解析条目，脚本回传直链时校验
          const token = crypto.randomUUID();
          const pending = this.readXimalayaPending();
          pending[token] = {
            trackIds: r.requires.payload?.trackIds ?? [],
            collected: [],
            createdAt: Date.now(),
          };
          this.writeXimalayaPending(pending);
          return {
            isDirect: false,
            urls: [url],
            items: [],
            platform: r.platform,
            requires: {
              ...r.requires,
              payload: { ...r.requires.payload, token },
            },
          };
        }
        return {
          isDirect: false,
          urls: [url],
          items: [],
          platform: r.platform,
          requires: r.requires,
        };
      }
      // 带 Cookie 解析成功 → 记住 Cookie（下次解析自动带上，不必每次填写）
      if (cookie?.trim() && r.items.length > 0) {
        try {
          const cur = this.readSettings();
          if (cur.ximalayaCookie !== cookie.trim()) {
            this.writeSettings({ ...cur, ximalayaCookie: cookie.trim() });
          }
        } catch {
          /* 保存失败不影响解析结果 */
        }
      }
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

  // ==================== 喜马拉雅 · 浏览器辅助解析 ====================
  // 喜马拉雅防盗链：baseInfo 直链接口有 WAF 指纹风控，Node 后端直连恒 1001；
  // 需用户在已登录的喜马拉雅页面（www.ximalaya.com）Console 运行脚本，
  // 脚本在同源页面取直链（自动带登录态 + 页面解密库）并回传本服务。

  private readonly ximalayaPendingFile = path.join(this.dataDir, 'ximalaya-pending.json');

  private readXimalayaPending(): Record<string, XimalayaPendingEntry> {
    return this.readJson(this.ximalayaPendingFile, {});
  }

  private writeXimalayaPending(map: Record<string, XimalayaPendingEntry>): void {
    this.writeJson(this.ximalayaPendingFile, map);
  }

  /** 生成浏览器辅助脚本（用户在已登录的喜马拉雅页面 Console 粘贴运行） */
  getXimalayaScript(token: string, baseUrl: string): { script: string } {
    const pending = this.readXimalayaPending();
    const entry = pending[token];
    if (!entry || entry.trackIds.length === 0) {
      throw new BadRequestException('令牌无效或已过期，请重新发起解析');
    }
    const tracksJson = JSON.stringify(entry.trackIds);
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/child-tv/ximalaya/collect`;
    const script = `(async () => {
  var TOKEN = ${JSON.stringify(token)};
  var ENDPOINT = ${JSON.stringify(endpoint)};
  var TRACKS = ${tracksJson};
  var CJ = window.DUCryptoJS;
  if (!CJ) { alert('未检测到解密库：请确认当前页面是已登录的喜马拉雅页面 www.ximalaya.com（声音/专辑页均可）'); return; }
  var KEY = CJ.enc.Hex.parse('aaad3e4fd540b0f79dca95606e72bf93');
  var results = [];
  for (var i = 0; i < TRACKS.length; i++) {
    var t = TRACKS[i];
    try {
      var r = await fetch('https://www.ximalaya.com/mobile-playpage/track/v3/baseInfo/' + Date.now() + '?device=web&trackId=' + t.id + '&trackQualityLevel=1', { credentials: 'include' });
      var j = await r.json();
      var list = j && j.trackInfo && j.trackInfo.playUrlList;
      if (!list || !list.length) { results.push({ id: t.id, err: '无播放地址(ret=' + (j && j.ret) + ')' }); console.log('[x]', t.title.slice(0, 20), 'ret=' + (j && j.ret)); continue; }
      var dec = '';
      try {
        dec = CJ.AES.decrypt({ ciphertext: CJ.enc.Base64.parse(String(list[0].url).replace(/-/g, '+').replace(/_/g, '/')) }, KEY, { mode: CJ.mode.ECB, padding: CJ.pad.Pkcs7 }).toString(CJ.enc.Utf8);
      } catch (e2) { dec = ''; }
      if (!dec || !/^https?:/.test(dec)) { results.push({ id: t.id, err: '解密失败' }); console.log('[x]', t.title.slice(0, 20), '解密失败'); continue; }
      results.push({ id: t.id, title: t.title, url: dec });
      console.log('[' + (i + 1) + '/' + TRACKS.length + '] OK', t.title.slice(0, 20), dec.slice(0, 60) + '...');
    } catch (e) { results.push({ id: t.id, err: e.message }); console.log('[x]', t.title.slice(0, 20), e.message); }
  }
  var ok = results.filter(function (x) { return x.url; }).length;
  try {
    var form = new URLSearchParams();
    form.set('token', TOKEN);
    form.set('payload', JSON.stringify(results));
    await fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    alert('喜马拉雅解析完成：成功 ' + ok + ' 条' + (ok < TRACKS.length ? '，失败 ' + (TRACKS.length - ok) + ' 条（详情见控制台）' : ''));
  } catch (e) { alert('回传失败：' + e.message + '（请检查服务是否在运行）'); }
})();`;
    return { script };
  }

  /** 脚本回传直链：校验令牌与地址白名单后暂存（一次性，1 小时有效） */
  collectXimalayaResults(token: string, payload: string): { ok: boolean; message: string } {
    const pending = this.readXimalayaPending();
    const entry = pending[token];
    if (!entry) throw new BadRequestException('令牌无效或已过期，请重新发起解析');
    if (Date.now() - entry.createdAt > 3600_000) {
      throw new BadRequestException('令牌已过期（1 小时），请重新发起解析');
    }
    let results: { id?: string; title?: string; url?: string }[] = [];
    try {
      results = JSON.parse(payload || '[]') as { id?: string; title?: string; url?: string }[];
      if (!Array.isArray(results)) throw new Error('not array');
    } catch {
      throw new BadRequestException('回传数据格式错误');
    }
    const validIds = new Set(entry.trackIds.map((t) => t.id));
    const collected: { id: string; title?: string; url: string }[] = [];
    for (const r of results) {
      if (!r.id || !validIds.has(String(r.id))) continue;
      if (r.url && /^https:\/\//i.test(r.url) && /xmcdn\.com/i.test(r.url)) {
        collected.push({ id: String(r.id), title: r.title || undefined, url: r.url });
      }
    }
    entry.collected = collected;
    pending[token] = entry;
    this.writeXimalayaPending(pending);
    return { ok: true, message: `已接收 ${collected.length}/${entry.trackIds.length} 条直链` };
  }

  /** 查询浏览器辅助解析结果（前端"我已运行脚本"后拉取，按原顺序返回） */
  getXimalayaPendingResult(
    token: string,
  ): { items: { title?: string; url: string }[]; failed: { id: string; title: string; err?: string }[] } {
    const pending = this.readXimalayaPending();
    const entry = pending[token];
    if (!entry) throw new BadRequestException('令牌无效或已过期，请重新发起解析');
    const byId = new Map(entry.collected.map((c) => [c.id, c]));
    const items: { title?: string; url: string }[] = [];
    const failed: { id: string; title: string; err?: string }[] = [];
    for (const t of entry.trackIds) {
      const c = byId.get(t.id);
      if (c) {
        items.push({ title: c.title || t.title, url: c.url });
      } else {
        failed.push({ id: t.id, title: t.title, err: '未获取到直链' });
      }
    }
    return { items, failed };
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

  /** 检测 ffprobe 可执行文件（mpv 同目录优先，其次 PATH） */
  private detectFfprobe(): string | null {
    const mpv = this.detectMpv();
    if (mpv) {
      const dir = path.dirname(mpv);
      for (const name of ['ffprobe.exe', 'ffprobe']) {
        const p = path.join(dir, name);
        if (fs.existsSync(p)) return p;
      }
    }
    try {
      const cmd = process.platform === 'win32' ? 'where ffprobe' : 'which ffprobe';
      const r = execSync(cmd, { encoding: 'utf8', windowsHide: true, timeout: 5000 });
      const line = r
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find((s) => s && fs.existsSync(s));
      if (line) return line;
    } catch { /* ignore */ }
    return null;
  }

  /** 探测单个本地媒体文件时长（秒）；无 ffprobe / 失败返回 null */
  private probeFileDuration(file: string): Promise<number | null> {
    const ffprobe = this.detectFfprobe();
    if (!ffprobe) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        exec(
          `"${ffprobe}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`,
          { windowsHide: true, timeout: 15_000 },
          (err, stdout) => {
            if (err || !stdout) return resolve(null);
            const d = Number.parseFloat(stdout.trim());
            resolve(Number.isFinite(d) && d > 0 ? Math.round(d) : null);
          },
        );
      } catch {
        resolve(null);
      }
    });
  }

  /** 并发探测一组本地文件时长（并发上限 4），命中缓存直接复用；返回 fullIndex → 时长（秒） */
  private async probeEntriesDurations(
    targets: Array<{ fullIndex: number; path: string }>,
  ): Promise<Map<number, number>> {
    const cache = new Map(this.fileDurationStore.findAll().map((r) => [r.path, r.duration]));
    const result = new Map<number, number>();
    // 缓存命中
    for (const t of targets) {
      const c = cache.get(t.path);
      if (c && c > 0) result.set(t.fullIndex, c);
    }
    const pending = targets.filter((t) => !result.has(t.fullIndex));
    const limit = 4;
    const queue = pending.slice();
    const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length > 0) {
        const t = queue.shift()!;
        const d = await this.probeFileDuration(t.path);
        if (d != null && d > 0) {
          result.set(t.fullIndex, d);
          // 写入持久化缓存（path 去重）
          const rows = this.fileDurationStore.findAll();
          const existing = rows.find((r) => r.path === t.path);
          if (existing) {
            if (existing.duration !== d) this.fileDurationStore.update(existing.id, { duration: d });
          } else {
            this.fileDurationStore.create({ id: crypto.randomUUID(), path: t.path, duration: d });
          }
        }
      }
    });
    await Promise.all(workers);
    return result;
  }

  /** 合集全部条目的总时长（秒）：本地文件条目取 items.duration / 文件时长缓存；未知条目不计数 */
  private collectionTotalDuration(collection: ChildTvCollection): number | null {
    const cache = new Map(this.fileDurationStore.findAll().map((r) => [r.path, r.duration]));
    let total = 0;
    let known = 0;
    for (const item of collection.items) {
      if (item.type === 'file') {
        const d = item.duration ?? cache.get(item.value);
        if (d && d > 0) {
          total += d;
          known++;
        }
      }
    }
    return known > 0 ? total : null;
  }

  /** 合集播放进度列表（控制台展示"上次播到第几集/位置"） */
  getCollectionProgress(): ChildTvCollectionProgressInfo[] {
    return this.progressStore
      .findAll()
      .map((p) => ({ collectionId: p.collectionId, entryIndex: p.entryIndex, position: p.position ?? null, updatedAt: p.updatedAt }))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  /** 按合集展开播放列表：folder 递归扫描按文件名排序、file 单文件、url 直链/合集解析 */
  private async resolveCollectionPlaylist(collection: ChildTvCollection): Promise<{
    entries: Array<{ title: string; target: string; isXimalaya: boolean }>;
    skipped: string[];
  }> {
    const entries: Array<{ title: string; target: string; isXimalaya: boolean }> = [];
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
          entries.push({
            title: path.basename(f),
            target: f,
            isXimalaya: XIMALAYA_EXTS.has(path.extname(f).toLowerCase()),
          });
        }
      } else if (item.type === 'file') {
        if (!fs.existsSync(item.value)) {
          skipped.push(`${item.value}（文件不存在）`);
          continue;
        }
        entries.push({
          title: item.title || path.basename(item.value),
          target: item.value,
          isXimalaya: XIMALAYA_EXTS.has(path.extname(item.value).toLowerCase()),
        });
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
          entries.push({ title: u.title || u.url, target: u.url, isXimalaya: false });
        }
      }
    }
    return { entries, skipped };
  }

  /** 解析时段播放资源：mpv 条目生成 m3u；xm 条目分离（喜马拉雅客户端打开），进度按合集完整条目索引记录 */
  private async resolveResource(s: ChildTvSchedule, overrideStart?: number): Promise<{
    title: string;
    args: string[];
    /** mpv 列表第 i 项在完整条目列表中的索引（playlist-pos → 完整索引映射） */
    mpvToFull: number[];
    /** 喜马拉雅 xm 条目（按完整列表顺序） */
    xmFiles: Array<{ title: string; path: string; fullIndex: number }>;
    /** 完整条目数 */
    fullCount: number;
    /** 上次播放到的完整列表索引（续播起点，0 = 从头） */
    fullStart: number;
    /** 完整条目按 fullIndex 的时长（秒，本地文件探测，未知为 null） */
    durations: (number | null)[];
    /** 完整条目按 fullIndex 的标题（控制台展示当前播放内容） */
    entryTitles: string[];
  }> {
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
    // 播放条目分流：.xm 喜马拉雅文件为专有格式（ID3 头 + 非 MPEG 音频体），mpv 无法解码，
    // 一律分离走喜马拉雅客户端逐集播放（服务端定时自动切集实现连播）；
    // 视频 / 网页直链 / 本地音视频进 mpv 播放列表连播
    const mpvToFull: number[] = [];
    const xmFiles: Array<{ title: string; path: string; fullIndex: number }> = [];
    const mpvEntries: Array<{ title: string; target: string }> = [];
    entries.forEach((e, idx) => {
      if (e.isXimalaya) {
        xmFiles.push({ title: e.title, path: e.target, fullIndex: idx });
      } else {
        mpvEntries.push({ title: e.title, target: e.target });
        mpvToFull.push(idx);
      }
    });

    const progress = this.progressStore.findAll().find((p) => p.collectionId === collection.id);
    // 指定起点（上一集/下一集/按集播放）优先；否则用上次播放进度
    const fullStart =
      overrideStart !== undefined
        ? overrideStart >= 0 && overrideStart < entries.length
          ? overrideStart
          : 0
        : progress && progress.entryIndex > 0 && progress.entryIndex < entries.length
          ? progress.entryIndex
          : 0;

    // 探测展开后本地文件的时长（播放时一次性，供控制台显示总时长/进度；URL 条目时长未知）
    const durationMap = await this.probeEntriesDurations(
      entries
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => !e.isXimalaya && fs.existsSync(e.target))
        .map(({ e, i }) => ({ fullIndex: i, path: e.target })),
    );
    const durations: (number | null)[] = entries.map((_, idx) => durationMap.get(idx) ?? null);
    const entryTitles: string[] = entries.map((e) => e.title);

    const args: string[] = [];
    if (mpvEntries.length > 0) {
      // 直接命令行参数传播放列表（不用 m3u 文件）：Windows 版 mpv 按 ANSI 读 m3u 会导致中文路径乱码，
      // 且强制 --demuxer=lavf 时会把 m3u 入口本身当媒体解码失败；命令行参数由 Windows 以 UTF-16 传递，中文路径天然正确
      for (const e of mpvEntries) args.push(e.target);
      args.push('--loop-playlist=inf');
      // B 站解析出的直链（upos/bilivideo CDN）播放时必须带 Referer，否则返回 403
      if (mpvEntries.some((e) => /bilivideo\.com|bilibili\.com/i.test(e.target))) {
        args.push('--http-header-fields=Referer:https://www.bilibili.com');
      }
      // 续播起点（完整索引 → mpv 列表位置；所有条目均在 mpv 列表，映射始终成立）
      const mpvStartPos = mpvToFull.indexOf(fullStart);
      if (mpvStartPos > 0) args.push(`--playlist-start=${mpvStartPos}`);
      if (progress && fullStart > 0) {
        this.log('info', `合集「${collection.name}」从第 ${fullStart + 1} 项续播（共 ${entries.length} 项）`);
      }
    }
    return {
      title: `${collection.name}（${entries.length} 项）`,
      args,
      mpvToFull,
      xmFiles,
      fullCount: entries.length,
      fullStart,
      durations,
      entryTitles,
    };
  }

  private buildMpvArgs(s: ChildTvSchedule, args: string[], opts?: { noAudio?: boolean }): string[] {
    const common = [
      '--fullscreen',
      '--ontop', // 全屏 + 屏幕最上层（不锁键，孩子能看也能操作）
      '--no-border',
      '--save-position-on-quit',
      '--resume-playback',
      '--quiet',
      '--keep-open=no',
      '--force-window=yes',
      // 全屏自动播放无需屏幕菜单；OSC 在音频轨失败等异常态可能自动触发 quit（osc/__keybinding11），禁用可避免"秒退"
      '--osc=no',
      // 抖音/B站等 CDN 对默认 UA 返回 403，必须使用浏览器 UA
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      // mpv 运行日志（诊断播放异常退出）
      `--log-file=${path.join(this.dataDir, 'childtv-mpv.log')}`,
      // 开启 mpv IPC，用于周期性读取播放位置（记录合集播放进度）
      `--input-ipc-server=${this.mpvIpcPath()}`,
    ];
    if (s.mediaType === 'audio') common.push('--no-video');
    // 音频输出设备不可用时降级为静音输出：视频正常播放不跳变、纯音频静音不报错
    if (opts?.noAudio) common.push('--ao=null');
    return [...common, ...args];
  }

  /** mpv IPC 通道：Windows 命名管道 / 其他平台 unix socket */
  private mpvIpcPath(): string {
    return process.platform === 'win32'
      ? '\\\\.\\pipe\\lifeos_childtv'
      : '/tmp/lifeos-childtv.sock';
  }

  async startPlayback(
    source: { scheduleId?: string; collectionId?: string },
    manual: boolean,
    overrideStart?: number,
  ): Promise<ChildTvRuntimeStatus> {
    // 播放源解析：优先时段；否则直接按合集立即播放（构造临时时段，复用同一播放管线）
    let schedule: ChildTvSchedule | null = null;
    if (source.scheduleId) {
      schedule = this.schedulesStore.findAll().find((s) => s.id === source.scheduleId) ?? null;
      if (!schedule) throw new NotFoundException('时段不存在');
    } else if (source.collectionId) {
      const collection = this.collectionsStore.findAll().find((c) => c.id === source.collectionId);
      if (!collection) throw new NotFoundException('合集不存在');
      const now = new Date().toISOString();
      schedule = {
        id: `manual-col-${collection.id}`,
        name: collection.name,
        weekdays: [],
        start: '00:00',
        durationMinutes: this.readSettings().immediatePlayDurationMinutes,
        collectionId: collection.id,
        mediaType: 'video',
        enabled: true,
        createdAt: now,
        updatedAt: now,
      };
    } else {
      throw new BadRequestException('请选择要播放的时段或合集');
    }
    if (!schedule.enabled && !manual) throw new BadRequestException('该时段未启用');

    if (this.player || this.externalPlay) {
      await this.stopPlayback('切换播放内容');
    }

    // 平台路由：非 local 合集走外部播放（浏览器打开页面 / 喜马拉雅客户端），无需 mpv
    const routeCollection = schedule.collectionId
      ? this.collectionsStore.findAll().find((c) => c.id === schedule.collectionId)
      : null;
    const platform = routeCollection?.platform ?? 'local';
    if (platform !== 'local') {
      if (!routeCollection) throw new BadRequestException('合集不存在');
      return this.startExternalPlayback(routeCollection, schedule, manual);
    }

    let resolved: {
      title: string;
      args: string[];
      mpvToFull: number[];
      xmFiles: Array<{ title: string; path: string; fullIndex: number }>;
      fullCount: number;
      fullStart: number;
      durations: (number | null)[];
      entryTitles: string[];
    };
    try {
      resolved = await this.resolveResource(schedule, overrideStart);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log('error', `播放「${schedule.name}」失败：${msg}`);
      throw new BadRequestException(msg);
    }

    // 纯 xm 合集 / 混合合集续播起点是 xm 条目：.xm 为专有格式只能喜马拉雅客户端播放，
    // 由服务端定时自动切集实现连播（无需 mpv）
    const xmAt = resolved.xmFiles.find((x) => x.fullIndex === resolved.fullStart);
    if (xmAt) {
      return this.startXimalayaFilePlayback(schedule, xmAt, manual, resolved.fullCount, resolved.xmFiles);
    }

    const mpv = this.detectMpv();
    if (!mpv) {
      this.log('error', `未检测到 mpv，无法播放「${schedule.name}」（请安装 mpv 或在设置中配置路径）`);
      throw new BadRequestException('未检测到 mpv 播放器，请安装后重试');
    }

    const durationMs =
      (manual
        ? this.readSettings().immediatePlayDurationMinutes
        : schedule.durationMinutes) * 60_000;
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + durationMs);

    this.player = {
      proc: null as unknown as ChildProcess,
      scheduleId: schedule.id,
      title: resolved.title,
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      manual,
      stopReason: null,
      collectionId: schedule.collectionId ?? null,
      ipcPath: this.mpvIpcPath(),
      audioFallback: false,
      mpvToFull: resolved.mpvToFull.length > 0 ? resolved.mpvToFull : null,
      durations: resolved.durations,
      entryTitles: resolved.entryTitles,
    };
    // 启动 mpv；音频输出设备不可用时自动降级为静音模式重启一次（视频正常播放、纯音频静音不报错）
    // mpv --log-file 为每次启动覆盖写，exit 时日志即本次播放完整记录，直接检查音频失败特征
    const spawnMpv = (useNoAudio: boolean) => {
      const proc = spawn(mpv, this.buildMpvArgs(schedule, resolved.args, { noAudio: useNoAudio }), {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      if (this.player) this.player.proc = proc;
      proc.on('error', (err) => {
        this.log('error', `mpv 启动失败：${err.message}`);
        if (this.player?.proc === proc) this.player = null;
      });
      proc.on('exit', (code) => {
        this.log('info', `mpv 退出（code=${code}）「${resolved.title}」`);
        if (this.player?.proc !== proc) return;
        // 音频初始化失败时 mpv 可能以任意退出码结束（含 code=0），以本次日志特征为准
        if (!this.player.audioFallback && this.detectAudioDeviceFailure()) {
          this.player.audioFallback = true;
          this.log(
            'warn',
            `检测到音频输出设备不可用（0x80040154），已自动以静音模式（--ao=null）重新播放「${resolved.title}」；视频可正常播放，如需声音请修复系统音频`,
          );
          spawnMpv(true);
          return;
        }
        const stopReason = this.player?.stopReason ?? '播放结束';
        const { startedAt: st, collectionId } = this.player;
        if (collectionId) void this.recordPlaybackProgress();
        this.player = null;
        this.finishStats(resolved.title, schedule.id, manual, st ? new Date(st) : startedAt, new Date(), stopReason);
      });
      return proc;
    };
    spawnMpv(false);
    // 恢复上次播放位置：合集进度记录了"条目内位置"且续播起点正是该条目时，mpv 启动后 IPC 定位到该秒
    const resumeProgress = this.progressStore.findAll().find((p) => p.collectionId === schedule.collectionId);
    if (resumeProgress && resumeProgress.position && resumeProgress.position > 0) {
      if (resumeProgress.entryIndex === resolved.fullStart && this.player) {
        void this.seekMpvToPosition(this.player.ipcPath, resumeProgress.position);
      }
    }
    // 播放中周期性记录进度（下一次 tick 起持续刷新，任何方式停止/崩溃都留有最近进度）
    void this.recordPlaybackProgress();
    this.log('info', `${manual ? '家长手动' : '定时'}播放开始「${resolved.title}」${schedule.mediaType === 'audio' ? '(音频)' : '(视频)'}`);
    return await this.getRuntimeStatus();
  }

  /** 检测喜马拉雅客户端可执行文件（常见安装位置） */
  private detectXimalayaApp(): string | null {
    const candidates = [
      path.join('D:', 'app', 'ximalaya', '喜马拉雅.exe'),
      'C:\\Program Files\\Ximalaya\\喜马拉雅.exe',
      'C:\\Program Files (x86)\\Ximalaya\\喜马拉雅.exe',
      'C:\\Program Files\\Ximalaya\\Ximalaya.exe',
      'C:\\Program Files (x86)\\Ximalaya\\Ximalaya.exe',
      path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Ximalaya', '喜马拉雅.exe'),
      path.join(process.env.LOCALAPPDATA ?? '', 'Ximalaya', '喜马拉雅.exe'),
      path.join(process.env.PROGRAMFILES ?? '', 'Ximalaya', '喜马拉雅.exe'),
    ];
    for (const c of candidates) {
      try {
        if (fs.existsSync(c)) return c;
      } catch { /* ignore */ }
    }
    return null;
  }

  /**
   * 外部播放：web 用默认浏览器打开条目页面；ximalaya 启动喜马拉雅客户端并兜底浏览器打开页面。
   * 外部播放不经过 mpv（无全屏置顶/进度记录），停止时仅结束系统播放会话，不强制关闭浏览器/客户端窗口。
   */
  private async startExternalPlayback(
    collection: ChildTvCollection,
    schedule: ChildTvSchedule,
    manual: boolean,
  ): Promise<ChildTvRuntimeStatus> {
    // 此方法仅由平台路由在非 local 合集时调用，platform 必为 web 或 ximalaya
    const platform = (collection.platform ?? 'web') as 'web' | 'ximalaya';
    const pageItems = collection.items.filter((i) => i.type === 'url' && /^https?:\/\//i.test(i.value));
    if (pageItems.length === 0) {
      throw new BadRequestException(
        `合集「${collection.name}」没有可打开的网页链接，请添加网页地址（如喜马拉雅音频页 / 抖音视频页）`,
      );
    }
    const target = pageItems[0].value;
    const now = new Date();
    const durationMs =
      (manual ? this.readSettings().immediatePlayDurationMinutes : schedule.durationMinutes) * 60_000;
    const endsAt = new Date(now.getTime() + durationMs);

    // 用默认浏览器打开页面（平台已登录时可直接播放）
    try {
      const opener = spawn('cmd', ['/c', 'start', '', target], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      opener.unref();
    } catch (e) {
      this.log('warn', `浏览器打开「${target}」失败：${e instanceof Error ? e.message : String(e)}`);
    }

    if (platform === 'ximalaya') {
      const exe = this.detectXimalayaApp();
      if (exe) {
        try {
          // 喜马拉雅客户端为单实例且不支持命令行定位具体音频，仅激活软件；页面已由浏览器打开可正常播放
          const proc = spawn(exe, [target], { detached: true, stdio: 'ignore', windowsHide: true });
          proc.unref();
          this.log('info', `已启动喜马拉雅客户端：${exe}`);
        } catch (e) {
          this.log('warn', `启动喜马拉雅客户端失败：${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        this.log('warn', '未检测到喜马拉雅客户端，已使用浏览器打开喜马拉雅页面');
      }
    }

    this.externalPlay = {
      type: platform,
      title: `${collection.name}（${pageItems.length} 个链接）`,
      pageUrl: target,
      startedAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
      manual,
      collectionId: collection.id,
    };
    this.log(
      'info',
      `${manual ? '家长手动' : '定时'}播放（外部）开始「${collection.name}」：${
        platform === 'ximalaya' ? '打开喜马拉雅软件' : '浏览器打开页面'
      } → ${target}，到时自动结束播放会话（不强制关闭浏览器/客户端窗口）`,
    );
    return this.getRuntimeStatus();
  }

  /**
   * 播放本地 .xm 文件：用喜马拉雅客户端打开（关联命令已验证 喜马拉雅.exe "文件路径" 有效），
   * 并记录"播到第几集"进度（合集完整条目索引），下次播放从该集继续。
   */
  private async startXimalayaFilePlayback(
    schedule: ChildTvSchedule,
    xmFile: { title: string; path: string; fullIndex: number },
    manual: boolean,
    fullCount: number,
    xmFiles: Array<{ title: string; path: string; fullIndex: number }>,
  ): Promise<ChildTvRuntimeStatus> {
    if (!schedule.collectionId) throw new BadRequestException('合集不存在');
    const exe = this.detectXimalayaApp();
    if (!exe) {
      this.log('error', `未检测到喜马拉雅客户端，无法播放 .xm 文件「${xmFile.title}」（请安装喜马拉雅客户端）`);
      throw new BadRequestException('未检测到喜马拉雅客户端，无法播放 .xm 文件');
    }
    this.openXmWithClient(exe, xmFile.path);
    // 记录进度：播到第几集（合集完整条目索引），下次播放从该集继续
    this.saveProgress(schedule.collectionId, xmFile.fullIndex);
    const now = new Date();
    const durationMs =
      (manual ? this.readSettings().immediatePlayDurationMinutes : schedule.durationMinutes) * 60_000;
    this.externalPlay = {
      type: 'ximalaya-local',
      title: xmFile.title,
      pageUrl: xmFile.path,
      startedAt: now.toISOString(),
      endsAt: new Date(now.getTime() + durationMs).toISOString(),
      manual,
      collectionId: schedule.collectionId,
      entries: xmFiles,
      entryIndex: xmFile.fullIndex,
    };
    this.log(
      'info',
      `${manual ? '家长手动' : '定时'}播放「${schedule.name}」第 ${xmFile.fullIndex + 1}/${fullCount} 集：喜马拉雅客户端打开 ${xmFile.path}`,
    );
    // 自动切集连播：.xm 为专有格式只能逐集用客户端打开，按设置的单集时长到时自动打开下一集（循环）
    if (xmFiles.length > 1) {
      this.scheduleNextXmTrack();
      this.log('info', `喜马拉雅合集共 ${xmFiles.length} 集，已启用自动切集（每 ${this.readSettings().ximalayaTrackDurationMinutes ?? 15} 分钟切换下一集）`);
    }
    return this.getRuntimeStatus();
  }

  /** 用喜马拉雅客户端打开一个本地 .xm 文件 */
  private openXmWithClient(exe: string, filePath: string): void {
    try {
      const proc = spawn(exe, [filePath], { detached: true, stdio: 'ignore', windowsHide: true });
      proc.unref();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log('error', `启动喜马拉雅客户端失败：${msg}`);
    }
  }

  /** 安排下一次自动切集（仅在外部 ximalaya-local 会话进行中生效，循环播完回第 1 集）：
   *  标题轮询每 5s 检测播放结束 → 即时切下一集；同时保留时长兜底（检测失效时强制切） */
  private scheduleNextXmTrack(): void {
    if (this.xmPlayTimer) {
      clearTimeout(this.xmPlayTimer);
      this.xmPlayTimer = null;
    }
    if (this.xmTitlePollTimer) {
      clearInterval(this.xmTitlePollTimer);
      this.xmTitlePollTimer = null;
    }
    const ext = this.externalPlay;
    if (!ext || ext.type !== 'ximalaya-local') return;
    const entries = ext.entries ?? [];
    if (entries.length <= 1) return;
    const minutes = Math.min(60, Math.max(1, this.readSettings().ximalayaTrackDurationMinutes ?? 15));
    // 时长兜底：标题检测始终未触发时到点强制切集
    this.xmPlayTimer = setTimeout(() => {
      this.xmPlayTimer = null;
      this.advanceXmTrack('播放超时（标题检测未触发）');
    }, minutes * 60_000);
    // 标题轮询：检测播放结束 / 客户端已自行切集
    this.xmTitlePollTimer = setInterval(() => {
      void this.pollXmTrackEnd();
    }, 5000);
  }

  /** 归一化喜马拉雅窗口标题，用于与集名比对（去 .xm、去装饰、去平台名、去状态词） */
  private normalizeXmTitle(s: string): string {
    return s
      .replace(/\.xm$/i, '')
      .replace(/[【】\[\]（）(){}]/g, '')
      .replace(/[-—–_·|]\s*喜马拉雅|喜马拉雅\s*[-—–_·|]?/gi, '')
      .replace(/正在播放|播放中|已暂停|暂停中/gi, '')
      .trim()
      .toLowerCase();
  }

  /** 标题轮询：当前集仍在播 → 不动；客户端已切到合集中某集 → 同步进度；
   *  标题不再包含任何集名 → 判定本集播放结束 → 自动切下一集 */
  private async pollXmTrackEnd(): Promise<void> {
    if (this.xmPolling) return;
    this.xmPolling = true;
    try {
      const cur = this.externalPlay;
      if (!cur || cur.type !== 'ximalaya-local') return;
      const exe = this.detectXimalayaApp();
      if (!exe) return;
      const title = await this.readXimalayaWindowTitle(exe);
      if (!title) return;
      const list = cur.entries ?? [];
      if (list.length === 0) return;
      const normTitle = this.normalizeXmTitle(title);
      if (!normTitle) return;
      const curIdx = list.findIndex((x) => x.fullIndex === cur.entryIndex);
      const curNorm = this.normalizeXmTitle(cur.title || '');
      // 当前集名仍出现在标题里 → 本集播放中
      if (curNorm.length > 1 && (normTitle.includes(curNorm) || curNorm.includes(normTitle))) return;
      // 标题匹配合集中其他集 → 客户端已自行切集，同步进度后继续轮询
      const anyIdx = list.findIndex((x) => {
        const t = this.normalizeXmTitle(x.title || '');
        return t.length > 1 && (normTitle.includes(t) || t.includes(normTitle));
      });
      if (anyIdx >= 0) {
        const target = list[anyIdx];
        if (target.fullIndex !== cur.entryIndex) {
          cur.title = target.title;
          cur.pageUrl = target.path;
          cur.entryIndex = target.fullIndex;
          if (cur.collectionId) this.saveProgress(cur.collectionId, target.fullIndex);
          this.log('info', `喜马拉雅客户端已切至「${target.title}」，进度已同步`);
        }
        return;
      }
      // 标题不含任何集名 → 播放结束 → 切下一集
      this.advanceXmTrack('检测到播放结束');
    } finally {
      this.xmPolling = false;
    }
  }

  /** 切到下一集（循环），并重建切集定时器与轮询 */
  private advanceXmTrack(reason: string): void {
    const cur = this.externalPlay;
    if (!cur || cur.type !== 'ximalaya-local') return;
    const exe = this.detectXimalayaApp();
    if (!exe) return;
    const list = cur.entries ?? [];
    if (list.length === 0) return;
    const curIdx = list.findIndex((x) => x.fullIndex === cur.entryIndex);
    const nextIdx = curIdx < 0 || curIdx + 1 >= list.length ? 0 : curIdx + 1;
    const next = list[nextIdx];
    this.openXmWithClient(exe, next.path);
    cur.title = next.title;
    cur.pageUrl = next.path;
    cur.entryIndex = next.fullIndex;
    if (cur.collectionId) this.saveProgress(cur.collectionId, next.fullIndex);
    this.log('info', `喜马拉雅合集自动切集（${reason}）：第 ${nextIdx + 1}/${list.length} 集「${next.title}」`);
    this.scheduleNextXmTrack();
  }

  /** 记录合集播放进度（完整条目索引 + 条目内位置秒，mpv 与 xm 外部播放共用） */
  private saveProgress(collectionId: string, entryIndex: number, position?: number): void {
    const now = new Date().toISOString();
    const existing = this.progressStore.findAll().find((x) => x.collectionId === collectionId);
    if (existing) {
      this.progressStore.update(existing.id, { entryIndex, position, updatedAt: now });
    } else {
      this.progressStore.create({ id: crypto.randomUUID(), collectionId, entryIndex, position, updatedAt: now });
    }
  }

  /** 检测 mpv 日志（每次启动覆盖写）是否包含音频输出设备初始化失败特征 */
  private detectAudioDeviceFailure(): boolean {
    try {
      const logPath = path.join(this.dataDir, 'childtv-mpv.log');
      if (!fs.existsSync(logPath)) return false;
      const content = fs.readFileSync(logPath, 'utf-8');
      return /Could not open\/initialize audio device|0x80040154|no sound/i.test(content);
    } catch {
      return false;
    }
  }

  /** 等待指定进程退出（最长 waitMs 毫秒），用于确保旧 mpv 真正结束后再启动新播放 */
  private async waitProcessExit(pid: number, waitMs = 3000): Promise<void> {
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      try {
        process.kill(pid, 0); // Windows 下仅在进程存在时成功
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        return; // 进程已不存在
      }
    }
  }

  async stopPlayback(reason: string): Promise<{ success: boolean }> {
    if (this.player) {
      this.player.stopReason = reason;
      // 停止前尽力记录一次播放进度（tick 已周期性记录，此处兜底最后一次）
      if (this.player.collectionId) void this.recordPlaybackProgress();
      const pid = this.player.proc.pid;
      const proc = this.player.proc;
      try {
        // taskkill /T 连子进程一起结束（Windows 更可靠）；同步等待完成 + 进程退出，
        // 避免旧 mpv 未退出时新播放占用同一 IPC 管道失败（表现为换合集后仍在播旧内容）
        await new Promise<void>((resolve) => {
          exec(`taskkill /PID ${pid} /T /F`, () => resolve());
        });
        await this.waitProcessExit(pid);
      } catch {
        try {
          proc.kill();
        } catch { /* ignore */ }
      }
      this.log('info', `停止播放：${reason}`);
      this.player = null;
    }
    // 外部播放：web/ximalaya 仅结束会话（页面由用户自行关闭）；
    // ximalaya-local（本地 .xm 文件用喜马拉雅客户端播放）：停止 = 关闭喜马拉雅客户端 + 取消自动切集定时器
    if (this.externalPlay) {
      if (this.xmPlayTimer) {
        clearTimeout(this.xmPlayTimer);
        this.xmPlayTimer = null;
      }
      if (this.xmTitlePollTimer) {
        clearInterval(this.xmTitlePollTimer);
        this.xmTitlePollTimer = null;
      }
      const ext = this.externalPlay;
      if (ext.type === 'ximalaya-local') {
        const exe = this.detectXimalayaApp();
        if (exe) {
          try {
            // 关闭喜马拉雅客户端进程（停止本地 .xm 播放；单实例，关掉即停止声音）
            await new Promise<void>((resolve) => {
              exec(`taskkill /IM "${path.basename(exe)}" /F /T`, () => resolve());
            });
          } catch {
            /* ignore */
          }
          this.log('info', `停止播放「${ext.title}」：${reason}（已关闭喜马拉雅客户端）`);
        } else {
          this.log('info', `停止播放「${ext.title}」：${reason}`);
        }
      } else {
        this.log('info', `停止播放「${ext.title}」：${reason}（不强制关闭浏览器/客户端窗口）`);
      }
      this.finishStats(
        ext.title,
        null,
        ext.manual,
        new Date(ext.startedAt),
        new Date(),
        reason,
      );
      this.externalPlay = null;
    }
    return { success: true };
  }

  // ==================== 播放进度记录/恢复 ====================

  /** 通过 mpv IPC 查询属性（Windows 命名管道 / unix socket），失败返回 null */
  private queryMpvProperty(ipcPath: string | null, property: string): Promise<unknown> {
    return new Promise((resolve) => {
      if (!ipcPath) {
        resolve(null);
        return;
      }
      let socket: net.Socket;
      try {
        socket = net.connect(ipcPath);
      } catch {
        resolve(null);
        return;
      }
      let settled = false;
      const done = (v: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { socket.destroy(); } catch { /* ignore */ }
        resolve(v);
      };
      const timer = setTimeout(() => done(null), 1500);
      socket.on('error', () => done(null));
      socket.on('connect', () => {
        socket.write(`${JSON.stringify({ command: ['get_property', property], request_id: 1 })}\n`);
      });
      let buf = '';
      socket.on('data', (chunk) => {
        buf += chunk.toString('utf8');
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          let msg: { request_id?: number; error?: string; data?: unknown };
          try {
            msg = JSON.parse(line.trim());
          } catch {
            continue; // 忽略非 JSON 行
          }
          if (!msg || typeof msg !== 'object') continue;
          if (msg.request_id === 1) {
            if (msg.error === 'success' || msg.error === undefined) done(msg.data ?? null);
            else done(null);
          }
        }
      });
    });
  }

  /** 通过 mpv IPC 发送命令（如 seek），成功（error=success）返回 true */
  private sendMpvCommand(ipcPath: string | null, payload: unknown): Promise<boolean> {
    return new Promise((resolve) => {
      if (!ipcPath) {
        resolve(false);
        return;
      }
      let socket: net.Socket;
      try {
        socket = net.connect(ipcPath);
      } catch {
        resolve(false);
        return;
      }
      let settled = false;
      const done = (v: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { socket.destroy(); } catch { /* ignore */ }
        resolve(v);
      };
      const timer = setTimeout(() => done(false), 1500);
      socket.on('error', () => done(false));
      socket.on('connect', () => {
        socket.write(`${JSON.stringify({ ...(payload as object), request_id: 1 })}\n`);
      });
      let buf = '';
      socket.on('data', (chunk) => {
        buf += chunk.toString('utf8');
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          let msg: { request_id?: number; error?: string };
          try {
            msg = JSON.parse(line.trim());
          } catch {
            continue;
          }
          if (!msg || typeof msg !== 'object') continue;
          if (msg.request_id === 1) {
            done(msg.error === 'success' || msg.error === undefined);
            return;
          }
        }
      });
    });
  }

  /** mpv 启动后定位到指定位置（秒）：IPC 就绪需数秒，重试至成功或超时 */
  private async seekMpvToPosition(ipcPath: string | null, position: number): Promise<void> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const ok = await this.sendMpvCommand(ipcPath, { command: ['seek', position, 'absolute'] });
      if (ok) {
        this.log('info', `已从上次位置 ${position}s 续播`);
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    this.log('warn', `恢复播放位置失败（${position}s），将从集首播放`);
  }

  /** 记录当前播放位置：条目索引（0-based）与条目内位置（秒）写入合集进度 */
  private async recordPlaybackProgress(): Promise<void> {
    const p = this.player;
    if (!p || !p.collectionId || !p.ipcPath) return;
    const [pos, timePos] = await Promise.all([
      this.queryMpvProperty(p.ipcPath, 'playlist-pos'),
      this.queryMpvProperty(p.ipcPath, 'time-pos'),
    ]);
    if (typeof pos !== 'number' || pos < 0) return;
    // 混合合集（mpv + xm）：playlist-pos 是 mpv 列表位置，映射回合集完整条目索引
    const fullIndex = p.mpvToFull && p.mpvToFull[pos] !== undefined ? p.mpvToFull[pos] : pos;
    const position = typeof timePos === 'number' && timePos > 0 ? Math.round(timePos) : undefined;
    this.saveProgress(p.collectionId, fullIndex, position);
  }

  /** 同步喜马拉雅本地播放进度：客户端窗口标题 = 当前播放文件，映射回合集条目索引（尽力而为） */
  private async syncXimalayaProgress(): Promise<void> {
    const ext = this.externalPlay;
    if (!ext || ext.type !== 'ximalaya-local' || !ext.entries?.length || !ext.collectionId) return;
    const exe = this.detectXimalayaApp();
    if (!exe) return;
    const title = await this.readXimalayaWindowTitle(exe);
    if (!title) return;
    const norm = (s: string) => s.replace(/\.xm$/i, '').trim();
    const want = norm(title);
    let idx = -1;
    for (let i = 0; i < ext.entries.length; i++) {
      const t = norm(ext.entries[i].title);
      if (t === want || (t.length > 1 && (t.includes(want) || want.includes(t)))) {
        idx = i;
        break;
      }
    }
    if (idx >= 0 && idx !== ext.entryIndex) {
      // idx 为 xm 分离列表内索引，entryIndex 需存合集完整条目索引（fullIndex）
      const fullIndex = ext.entries[idx].fullIndex ?? idx;
      ext.entryIndex = fullIndex;
      this.saveProgress(ext.collectionId, fullIndex);
      this.log('info', `喜马拉雅客户端播放进度同步：第 ${idx + 1} 集「${ext.entries[idx].title}」`);
    }
  }

  /** 读取喜马拉雅客户端窗口标题（Windows：PowerShell 查询进程主窗口标题） */
  private readXimalayaWindowTitle(exePath: string): Promise<string | null> {
    return new Promise((resolve) => {
      const name = path.basename(exePath, '.exe');
      exec(
        `powershell -NoProfile -NonInteractive -Command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Process -Name '${name}' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1 -ExpandProperty MainWindowTitle"`,
        { encoding: 'utf8', windowsHide: true, timeout: 8000 },
        (err, stdout) => {
          if (err || !stdout) return resolve(null);
          const t = stdout.trim();
          resolve(t || null);
        },
      );
    });
  }

  /** 手动立即播放指定时段（本机 mpv 播放） */
  async playNow(dto: { scheduleId?: string; collectionId?: string; entryIndex?: number }): Promise<ChildTvRuntimeStatus> {
    return this.startPlayback(
      { scheduleId: dto?.scheduleId, collectionId: dto?.collectionId },
      true,
      dto?.entryIndex,
    );
  }

  // ==================== 状态 ====================

  async getRuntimeStatus(): Promise<ChildTvRuntimeStatus> {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const activeSession = this.player ?? this.externalPlay;
    const playing = !!activeSession;
    const remainingMinutes = playing
      ? Math.max(0, Math.ceil((Date.parse(activeSession?.endsAt ?? now.toISOString()) - Date.now()) / 60_000))
      : null;
    const next = this.nextSchedule(nowMin);
    const mpv = this.detectMpv();

    // mpv 播放：实时读取条目索引、集内位置；总时长/已播时长用播放展开时的探测数据
    let currentIndex: number | null = null;
    let currentPosition: number | null = null;
    let currentDuration: number | null = null;
    let currentEntryTitle: string | null = null;
    let collectionPlayedSeconds: number | null = null;
    let collectionTotalDuration: number | null = null;
    let totalCount: number | null = null;
    let currentCollectionId: string | null = null;

    if (this.player) {
      currentCollectionId = this.player.collectionId;
      totalCount = this.player.entryTitles?.length ?? null;
      const [pos, timePos, dur] = await Promise.all([
        this.queryMpvProperty(this.player.ipcPath, 'playlist-pos'),
        this.queryMpvProperty(this.player.ipcPath, 'time-pos'),
        this.queryMpvProperty(this.player.ipcPath, 'duration'),
      ]);
      if (typeof pos === 'number' && pos >= 0) {
        const fullIndex =
          this.player.mpvToFull && this.player.mpvToFull[pos] !== undefined ? this.player.mpvToFull[pos] : pos;
        currentIndex = fullIndex;
        currentEntryTitle = this.player.entryTitles?.[fullIndex] ?? null;
        const known = this.player.durations?.[fullIndex];
        currentDuration =
          known && known > 0 ? known : typeof dur === 'number' && dur > 0 ? Math.round(dur) : null;
      }
      if (typeof timePos === 'number' && timePos > 0) currentPosition = Math.round(timePos);
      // 已播累计 = 之前条目的已知时长之和 + 当前条目位置；总时长 = 已探测条目之和
      if (this.player.durations && currentIndex !== null) {
        let played = 0;
        let total = 0;
        let known = 0;
        for (let i = 0; i < this.player.durations.length; i++) {
          const d = this.player.durations[i];
          if (d && d > 0) {
            total += d;
            known++;
            if (i < currentIndex) played += d;
          }
        }
        if (currentPosition !== null) played += currentPosition;
        collectionTotalDuration = known > 0 ? total : null;
        collectionPlayedSeconds = known > 0 ? played : null;
      }
    } else if (this.externalPlay) {
      currentCollectionId = this.externalPlay.collectionId;
      currentIndex = this.externalPlay.entryIndex ?? null;
      totalCount = this.externalPlay.entries?.length ?? null;
      // entryIndex 为合集完整条目索引，需在 xm 分离列表中按 fullIndex 定位标题
      const list = this.externalPlay.entries ?? [];
      const idxInList = currentIndex !== null ? list.findIndex((x) => x.fullIndex === currentIndex) : -1;
      currentEntryTitle = idxInList >= 0 ? list[idxInList].title : null;
    }

    return {
      playing,
      currentTitle: this.player?.title ?? this.externalPlay?.title ?? '',
      currentScheduleId: this.player?.scheduleId ?? null,
      startedAt: activeSession?.startedAt ?? null,
      endsAt: activeSession?.endsAt ?? null,
      remainingMinutes,
      manual: activeSession?.manual ?? false,
      nextSchedule: next
        ? {
            name: next.s.name,
            startLabel: next.s.start,
            startsInMinutes: next.startsInMinutes,
          }
        : null,
      mpv: this.player ? 'running' : mpv ? 'stopped' : 'missing',
      mpvAvailable: !!mpv,
      pinEnabled: this.pinEnabledForDefault(),
      audioFallback: this.player?.audioFallback ?? false,
      lastLog: this.lastLog,
      currentCollectionId,
      currentIndex,
      totalCount,
      currentEntryTitle,
      currentPosition,
      currentDuration,
      collectionTotalDuration,
      collectionPlayedSeconds,
    };
  }

  private pinEnabledForDefault(): boolean {
    const auth = this.readAuth();
    const parent = auth.accounts.find((a) => a.role === 'parent');
    return !!(parent?.pinHash ?? auth.accounts[0]?.pinHash ?? null);
  }

  /** 观看页使用：不暴露控制信息 */
  async getWatchStatus(): Promise<{
    playing: boolean;
    currentTitle: string;
    remainingMinutes: number | null;
    nextSchedule: ChildTvNextSchedule | null;
    endsAt: string | null;
    pinEnabled: boolean;
  }> {
    const s = await this.getRuntimeStatus();
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

      const sessionActive = !!this.player || !!this.externalPlay;
      if (active.length > 0 && !sessionActive) {
        await this.startPlayback({ scheduleId: active[0].id }, false);
      } else if (active.length === 0 && sessionActive) {
        const manual = this.player?.manual ?? this.externalPlay?.manual ?? false;
        if (!manual) void this.stopPlayback('时段窗口结束');
      }
      // 手动播放超时自动停止（含外部播放）
      const activeEnds = this.player?.endsAt ?? this.externalPlay?.endsAt ?? null;
      const activeManual = this.player?.manual ?? this.externalPlay?.manual ?? false;
      if (activeManual && activeEnds && Date.now() > Date.parse(activeEnds)) {
        void this.stopPlayback('手动播放时长已到');
      }
      // 兜底：播放进程意外退出但 session 未清（mpv crash）
      if (this.player && this.player.proc.exitCode !== null) {
        this.player = null;
      }
      // 播放中周期性记录合集播放进度（15s 一次，不阻塞调度）
      if (this.player) void this.recordPlaybackProgress();
      // 喜马拉雅客户端本地播放：窗口标题 = 当前播放文件，同步"播到第几集"进度
      if (this.externalPlay?.type === 'ximalaya-local') void this.syncXimalayaProgress();
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

  /** 扫描文件夹：递归收集全部音视频文件（含 .xm 喜马拉雅音频），按文件名自然排序，供前端导入预览 */
  scanFolder(targetPath: string): ChildTvScanResult {
    const p = path.resolve(targetPath);
    if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
      throw new BadRequestException('文件夹不存在');
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
    walk(p);
    files.sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
    return {
      path: p,
      files: files.map((f) => {
        const ext = path.extname(f).toLowerCase();
        let size = 0;
        try {
          size = fs.statSync(f).size;
        } catch { /* ignore */ }
        return {
          name: path.basename(f),
          path: f,
          kind: VIDEO_EXTS.has(ext) ? 'video' : 'audio',
          isXimalaya: XIMALAYA_EXTS.has(ext),
          size,
        };
      }),
    };
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

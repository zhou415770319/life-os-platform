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
import type {
  ChildTvAuthInfo,
  ChildTvBrowseResult,
  ChildTvLogEntry,
  ChildTvNextSchedule,
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

interface AuthFile {
  username: string;
  salt: string;
  /** sha256(salt + password) */
  passwordHash: string;
  /** 观看页 PIN 哈希（sha256 加盐），null 表示未启用 */
  pinHash: string | null;
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

const LOCK_RELEASE_FILE = '.child-tv-lock-release';
const LOCK_HEARTBEAT_FILE = '.child-tv-lock-heartbeat';
const LOCK_SCRIPT_FILE = '.child-tv-lock.ps1';
const M3U_FILE = 'child-tv-playlist.m3u';
const SECRET_FILE = 'child-tv-secret.txt';

@Injectable()
export class ChildTvService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('ChildTv');
  private readonly dataDir = path.resolve(process.cwd(), 'user-data');
  private readonly schedulesStore = new JsonStore<ChildTvSchedule>('child-tv-schedules.json');
  private readonly logsStore = new JsonStore<ChildTvLogEntry>('child-tv-log.json');
  private readonly statsStore = new JsonStore<ChildTvStatsEntry>('child-tv-stats.json');

  private authFile = path.join(this.dataDir, 'child-tv-auth.json');
  private settingsFile = path.join(this.dataDir, 'child-tv-settings.json');
  private secret: string;

  private player: PlayerSession | null = null;
  private lockProc: ChildProcess | null = null;
  private lockReason: 'playback' | 'manual' | null = null;
  private lockEndsAt: string | null = null;
  private lockTimer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private lastLog = '';
  private adminCached: boolean | null = null;
  private mpvPathCached: string | null | undefined;

  constructor() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.secret = this.loadOrCreateSecret();
    this.ensureAuthFile();
    this.ensureSettingsFile();
    this.ensureSeedSchedules();
  }

  // ==================== 生命周期 ====================

  onModuleInit(): void {
    // 服务启动：解除遗留锁定（进程重启即解锁）
    this.releaseLockFile();
    this.log('info', '儿童定时播放服务启动');
    this.tickTimer = setInterval(() => void this.tick(), 15_000);
    void this.tick();
  }

  onModuleDestroy(): void {
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
      username: 'admin',
      salt: '',
      passwordHash: '',
      pinHash: null,
      updatedAt: new Date().toISOString(),
    });
  }

  private writeAuth(auth: AuthFile): void {
    this.writeJson(this.authFile, auth);
  }

  private ensureAuthFile(): void {
    if (fs.existsSync(this.authFile)) return;
    const salt = crypto.randomBytes(16).toString('hex');
    this.writeAuth({
      username: 'admin',
      salt,
      passwordHash: this.hash(salt, '123456'),
      pinHash: null,
      updatedAt: new Date().toISOString(),
    });
    this.log('info', '已创建默认账号 admin（密码 123456，sha256 加盐存储）');
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
    };
  }

  readSettings(): ChildTvSettings {
    return { ...this.defaultSettings(), ...this.readJson<Partial<ChildTvSettings>>(this.settingsFile, {}) };
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

  // ==================== 鉴权 ====================

  private issueToken(username: string): string {
    const payload = Buffer.from(
      JSON.stringify({ u: username, exp: Date.now() + 7 * 24 * 3600_000 }),
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
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

  requireAuth(req: { headers?: Record<string, string | string[] | undefined> }): void {
    if (!this.verifyToken(this.extractToken(req))) {
      throw new UnauthorizedException('请先登录家长控制台');
    }
  }

  async login(username: string, password: string): Promise<{ token: string; username: string }> {
    const auth = this.readAuth();
    const ok =
      username === auth.username &&
      this.hash(auth.salt, password ?? '') === auth.passwordHash;
    if (!ok) throw new UnauthorizedException('用户名或密码错误');
    return { token: this.issueToken(username), username };
  }

  authInfo(req: { headers?: Record<string, string | string[] | undefined> }): ChildTvAuthInfo {
    const loggedIn = this.verifyToken(this.extractToken(req));
    const auth = this.readAuth();
    return {
      loggedIn,
      username: loggedIn ? auth.username : '',
      pinEnabled: !!auth.pinHash,
    };
  }

  /** 校验观看页 PIN（未启用时直接通过） */
  checkPin(pin: string): { ok: boolean } {
    const auth = this.readAuth();
    if (!auth.pinHash) return { ok: true };
    return { ok: this.hash(auth.salt, pin ?? '') === auth.pinHash };
  }

  async updateAccount(dto: {
    password?: string;
    pin?: string | null;
  }): Promise<{ username: string; pinEnabled: boolean }> {
    const auth = this.readAuth();
    if (dto.password !== undefined && dto.password !== '') {
      auth.passwordHash = this.hash(auth.salt, dto.password);
      auth.updatedAt = new Date().toISOString();
    }
    if (dto.pin !== undefined) {
      if (dto.pin === null || dto.pin === '') auth.pinHash = null;
      else auth.pinHash = this.hash(auth.salt, dto.pin);
      auth.updatedAt = new Date().toISOString();
    }
    this.writeAuth(auth);
    return { username: auth.username, pinEnabled: !!auth.pinHash };
  }

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
    this.log('info', `修改时段「${updated.name}」`);
    return updated;
  }

  deleteSchedule(id: string): { success: boolean } {
    const removed = this.schedulesStore.remove(id);
    if (!removed) throw new NotFoundException('时段不存在');
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

  /** 手动立即播放指定时段 */
  async playNow(scheduleId: string): Promise<ChildTvRuntimeStatus> {
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

  startLock(minutes: number, reason: 'playback' | 'manual'): ChildTvRuntimeStatus {
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
    this.log('info', `${reason === 'manual' ? '家长手动' : '随播放'}锁定电脑（最长 ${m} 分钟）`);
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
    const playing = !!this.player;
    const remainingMinutes = this.player
      ? Math.max(0, Math.ceil((Date.parse(this.player.endsAt) - Date.now()) / 60_000))
      : null;
    const next = this.nextSchedule(nowMin);
    const mpv = this.detectMpv();
    const locked = this.lockReason !== null || this.lockAlive();
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
      locked,
      lockReason: this.lockReason,
      lockEndsAt: this.lockEndsAt,
      mpv: playing ? 'running' : mpv ? 'stopped' : 'missing',
      mpvAvailable: !!mpv,
      admin: this.isAdmin(),
      pinEnabled: !!this.readAuth().pinHash,
      lastLog: this.lastLog,
    };
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
      pinEnabled: !!this.readAuth().pinHash,
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

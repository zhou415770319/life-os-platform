import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import {
  XmPlayerBrowseResult,
  XmPlayerCollection,
  XmPlayerConfig,
  XmPlayerRefreshResult,
  XmPlayerSchedule,
} from '@shared/api.interface';

const DATA_DIR = path.resolve(
  process.cwd(),
  'user-data',
  'plugins',
  'dsh-plugin-xm-player',
  'data',
);
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'snapshot.json');

/** Excel 工作表名（固定约定，示例 Excel 同此） */
const SHEET_COLLECTIONS = '合集';
const SHEET_PROGRESS = '进度';
const SHEET_SCHEDULES = '日程';

const EXCEL_EXT = /\.(xlsx|xls)$/i;

interface ParsedWorkbook {
  collections: XmPlayerCollection[];
  progress: Record<string, { currentIndex: number | null; currentTitle: string | null; updatedAt: string | null }>;
  schedules: XmPlayerSchedule[];
}

interface Snapshot {
  ids: string[];
  names: Record<string, string>;
  updatedAt: string;
}

@Injectable()
export class XmPlayerService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  /** 已触发的日程标记：key = `${scheduleId}-${yyyyMMdd}`，避免同一时段重复触发 */
  private triggeredKeys = new Set<string>();
  private stoppedKeys = new Set<string>();
  private readonly logger = new Logger('XmPlayerService');

  private loadConfig(): XmPlayerConfig {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      }
    } catch {
      /* ignore */
    }
    return {};
  }

  private saveConfig(cfg: XmPlayerConfig): void {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  }

  onModuleInit() {
    // 每分钟检查一次日程，到点触发播放
    this.timer = setInterval(() => {
      this.checkSchedulesAndTrigger().catch((e) => {
        this.logger.warn(`日程检查失败: ${e?.message || e}`);
      });
    }, 60 * 1000);
    this.logger.log('日程轮询已启动（每 60 秒检查一次）');
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 定时轮询：读取 Excel 日程表，到点自动把对应合集状态改为「待播放」写回 Excel（触发影刀文件触发器） */
  async checkSchedulesAndTrigger(): Promise<{ checked: number; triggered: string[]; stopped: string[]; errors: string[]; todayCn: string; nowMin: number }> {
    const cfg = this.loadConfig();
    const result = { checked: 0, triggered: [] as string[], stopped: [] as string[], errors: [] as string[], todayCn: '', nowMin: 0 };
    if (!cfg.excelPath || !fs.existsSync(cfg.excelPath)) return result;

    const now = new Date();
    const dayIdx = (now.getDay() + 6) % 7;
    const WEEK_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const todayCn = WEEK_CN[dayIdx];
    const nowMin = now.getHours() * 60 + now.getMinutes();
    result.todayCn = todayCn;
    result.nowMin = nowMin;
    const dateKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

    let parsed: ParsedWorkbook;
    try {
      parsed = this.parseWorkbook(cfg.excelPath);
    } catch (e) {
      result.errors.push(`读取 Excel 失败: ${(e as Error).message}`);
      return result;
    }
    result.checked = parsed.schedules.length;

    const toTrigger: { scheduleId: string; collectionId: string }[] = [];
    const toStop: { scheduleId: string; collectionId: string }[] = [];
    for (const s of parsed.schedules) {
      if (!s.enabled) continue;
      if (!s.weekdays || s.weekdays.length === 0) continue;
      if (!s.collectionId) continue;
      if (!s.start || !s.end) continue;
      if (!s.weekdays.includes(todayCn)) continue;

      const [sh, sm] = s.start.split(':').map(Number);
      const [eh, em] = s.end.split(':').map(Number);
      if (Number.isNaN(sh) || Number.isNaN(eh)) continue;
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      const schedKey = s.id || s.collectionId;

      // 开始时间到：待播放
      if (nowMin >= startMin && nowMin < endMin) {
        const key = `${schedKey}-${dateKey}`;
        if (!this.triggeredKeys.has(key)) {
          toTrigger.push({ scheduleId: key, collectionId: s.collectionId });
        }
        continue;
      }

      // 结束时间到（宽限 60 分钟内）：待停止
      if (nowMin >= endMin && nowMin < endMin + 60) {
        const key = `stop-${schedKey}-${dateKey}`;
        if (!this.stoppedKeys.has(key)) {
          toStop.push({ scheduleId: key, collectionId: s.collectionId });
        }
      }
    }

    // 清理过期缓存
    if (this.triggeredKeys.size > 200) {
      for (const k of Array.from(this.triggeredKeys)) {
        if (!k.endsWith(dateKey)) this.triggeredKeys.delete(k);
      }
    }
    if (this.stoppedKeys.size > 200) {
      for (const k of Array.from(this.stoppedKeys)) {
        if (!k.endsWith(dateKey)) this.stoppedKeys.delete(k);
      }
    }

    // 执行待播放
    for (const item of toTrigger) {
      const col = parsed.collections.find((c) => c.id === item.collectionId);
      if (!col) { result.errors.push(`合集 ${item.collectionId} 不存在`); continue; }
      if (col.status === '待播放' || col.status === '播放中') {
        this.triggeredKeys.add(item.scheduleId);
        continue;
      }
      try {
        this.updateStatus(item.collectionId, '待播放');
        this.triggeredKeys.add(item.scheduleId);
        result.triggered.push(item.collectionId);
        this.logger.log(`日程触发: ${item.collectionId} 状态已改为「待播放」`);
      } catch (e) {
        result.errors.push(`触发失败 ${item.collectionId}: ${(e as Error).message}（下轮重试）`);
      }
    }

    // 执行待停止
    for (const item of toStop) {
      const col = parsed.collections.find((c) => c.id === item.collectionId);
      if (!col) { result.errors.push(`合集 ${item.collectionId} 不存在`); continue; }
      // 只有正在播放相关状态才需要通知停止
      if (!['待播放', '播放中', '已暂停'].includes(col.status)) {
        this.stoppedKeys.add(item.scheduleId);
        continue;
      }
      try {
        this.updateStatus(item.collectionId, '待停止');
        this.stoppedKeys.add(item.scheduleId);
        result.stopped.push(item.collectionId);
        this.logger.log(`日程结束: ${item.collectionId} 状态已改为「待停止」，等待 RPA 停止`);
      } catch (e) {
        result.errors.push(`停止通知失败 ${item.collectionId}: ${(e as Error).message}（下轮重试）`);
      }
    }
    return result;
  }

  /** 播放/暂停/停止按钮：直接改合集状态写回 Excel（触发影刀文件触发器） */
  play(collectionId: string, action: 'play' | 'pause' | 'stop'): { ok: boolean; message: string } {
    // 先读当前状态，决定 stop 回到未开始还是已完成
    const cfg = this.loadConfig();
    let currentStatus = '';
    try {
      const parsed = this.parseWorkbook(cfg.excelPath);
      currentStatus = parsed.collections.find((c) => c.id === collectionId)?.status ?? '';
    } catch {
      /* ignore */
    }

    const status =
      action === 'play' ? '待播放' : action === 'pause' ? '已暂停' : currentStatus === '待播放' ? '未开始' : '已完成';
    try {
      const r = this.updateStatus(collectionId, status);
      if (!r.ok) return r;
    } catch (e) {
      const msg = (e as Error).message || '';
      if (msg.includes('EBUSY') || msg.includes('EPERM')) {
        return { ok: false, message: 'Excel 文件被占用，请关闭 Excel 后再点播放' };
      }
      return { ok: false, message: `操作失败：${msg}` };
    }
    const tips = {
      play: '已通知影刀，预计几秒后开始播放',
      pause: '已暂停，影刀将在 30 秒内停止播放',
      stop: status === '未开始' ? '已取消待播放，影刀将不执行播放' : '已停止，影刀将关闭喜马拉雅客户端',
    } as const;
    return { ok: true, message: tips[action] };
  }

  getConfig(): XmPlayerConfig {
    return this.loadConfig();
  }

  /** 选择 Excel 文件（Windows 原生对话框）并保存为配置 */
  async pickExcel(): Promise<{ picked: boolean; excelPath?: string }> {
    const script = [
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      'Add-Type -AssemblyName System.Windows.Forms',
      '$dlg = New-Object System.Windows.Forms.OpenFileDialog',
      '$dlg.Title = "选择合集 Excel 文件（合集/进度/日程）"',
      "$dlg.Filter = 'Excel 文件 (*.xlsx;*.xls)|*.xlsx;*.xls|所有文件 (*.*)|*.*'",
      '$dlg.Multiselect = $false',
      "if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dlg.FileName } else { Write-Output '' }",
    ].join('\r\n');
    const out = await this.runPowerShellScript(script);
    const p = (out || '').trim();
    if (!p) return { picked: false };
    if (!EXCEL_EXT.test(p)) {
      throw new BadRequestException('请选择 .xlsx / .xls 文件');
    }
    this.saveConfig({ excelPath: p });
    this.logger.log(`Excel 已配置：${p}`);
    return { picked: true, excelPath: p };
  }

  setExcelPath(pathStr: string): XmPlayerConfig {
    if (!pathStr || !EXCEL_EXT.test(pathStr)) {
      throw new BadRequestException('请输入有效的 .xlsx / .xls 文件路径');
    }
    if (!fs.existsSync(pathStr)) {
      throw new NotFoundException('文件不存在：' + pathStr);
    }
    const cfg = { excelPath: path.resolve(pathStr) };
    this.saveConfig(cfg);
    return cfg;
  }

  /** 打开 Excel 所在文件夹（并选中文件） */
  openExcelFolder(): { ok: boolean } {
    const cfg = this.loadConfig();
    if (!cfg.excelPath) throw new BadRequestException('尚未配置 Excel 文件');
    const cmd = `explorer.exe /select,"${cfg.excelPath}"`;
    exec(cmd, (err) => {
      if (err) this.logger.warn(`Open folder failed: ${err.message}`);
    });
    return { ok: true };
  }

  /** 当前配置的 Excel 文件信息 */
  private requireExcelPath(): string {
    const cfg = this.loadConfig();
    if (!cfg.excelPath) throw new BadRequestException('尚未配置 Excel 文件，请先选择');
    if (!fs.existsSync(cfg.excelPath)) {
      throw new NotFoundException('Excel 文件不存在，可能已被移动或删除：' + cfg.excelPath);
    }
    return cfg.excelPath;
  }

  // ===== 解析 =====

  private parseWorkbook(excelPath: string): ParsedWorkbook {
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.readFile(excelPath);
    } catch {
      throw new BadRequestException('无法解析 Excel 文件，请确认格式正确且未被占用');
    }
    const sheetNames = wb.SheetNames;
    const getSheet = (name: string): XLSX.WorkSheet | null => {
      const idx = sheetNames.findIndex((s) => s.trim() === name);
      return idx >= 0 ? wb.Sheets[sheetNames[idx]] : null;
    };
    const rowsOf = (ws: XLSX.WorkSheet | null): Record<string, unknown>[] =>
      ws ? (XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' }) as Record<string, unknown>[]) : [];

    const collectionRows = rowsOf(getSheet(SHEET_COLLECTIONS));
    const progressRows = rowsOf(getSheet(SHEET_PROGRESS));
    const scheduleRows = rowsOf(getSheet(SHEET_SCHEDULES));

    const collections: XmPlayerCollection[] = collectionRows
      .filter((r) => {
        const id = String(r['合集ID'] ?? r['合集ID'] ?? '');
        return id.trim() !== '';
      })
      .map((r) => ({
        id: String(r['合集ID']).trim(),
        name: String(r['名称'] ?? '').trim(),
        url: String(r['链接'] ?? '').trim() || undefined,
        totalEpisodes: this.toNumber(r['总集数']),
        status: String(r['状态'] ?? '').trim() || '未开始',
        note: String(r['备注'] ?? '').trim() || undefined,
      }));

    const progress: ParsedWorkbook['progress'] = {};
    for (const r of progressRows) {
      const id = String(r['合集ID'] ?? '').trim();
      if (!id) continue;
      progress[id] = {
        currentIndex: this.toNumber(r['当前集索引']),
        currentTitle: String(r['当前集名称'] ?? '').trim() || null,
        updatedAt: String(r['更新时间'] ?? '').trim() || null,
      };
    }

    const schedules: XmPlayerSchedule[] = scheduleRows
      .filter((r) => String(r['合集ID'] ?? '').trim() !== '')
      .map((r) => {
        const weekdaysRaw = String(r['星期'] ?? '');
        const weekdays = weekdaysRaw
          .split(/[,，;；、\s]+/)
          .map((w) => w.trim())
          .filter((w) => /^周[一二三四五六日天]$/.test(w));
        return {
          id: String(r['时段ID'] ?? '').trim() || this.genId(),
          enabled: this.toEnabled(r['启用']),
          weekdays: weekdays.length ? weekdays : ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
          start: String(r['开始时间'] ?? '').trim(),
          end: String(r['结束时间'] ?? '').trim(),
          collectionId: String(r['合集ID'] ?? '').trim(),
        };
      })
      .map((s) => {
        const col = collections.find((c) => c.id === s.collectionId);
        return { ...s, collectionName: col?.name };
      });

    return { collections, progress, schedules };
  }

  /** 合并进度信息，返回页面展示用合集列表 */
  private mergeProgress(p: ParsedWorkbook): XmPlayerCollection[] {
    return p.collections.map((c) => {
      const pg = p.progress[c.id];
      return {
        ...c,
        currentIndex: pg?.currentIndex ?? null,
        currentTitle: pg?.currentTitle ?? null,
        progressUpdatedAt: pg?.updatedAt ?? null,
      };
    });
  }

  /** 读取当前 Excel 全量数据（不 diff） */
  getData(): XmPlayerRefreshResult {
    const excelPath = this.requireExcelPath();
    const p = this.parseWorkbook(excelPath);
    return {
      excelPath,
      lastModified: this.lastModified(excelPath),
      collections: this.mergeProgress(p),
      schedules: p.schedules,
      added: 0,
      removed: 0,
      updated: 0,
    };
  }

  /** 刷新：重读 Excel 并与上次快照对比，返回增删更新数量 */
  refresh(): XmPlayerRefreshResult {
    const excelPath = this.requireExcelPath();
    const p = this.parseWorkbook(excelPath);
    const merged = this.mergeProgress(p);

    const prev = this.loadSnapshot();
    const newIds = p.collections.map((c) => c.id);
    const oldIds = prev?.ids ?? [];
    const added = newIds.filter((id) => !oldIds.includes(id)).length;
    const removed = oldIds.filter((id) => !newIds.includes(id)).length;
    let updated = 0;
    if (prev?.names) {
      for (const c of p.collections) {
        if (prev.names[c.id] && prev.names[c.id] !== c.name) updated++;
      }
    }
    this.saveSnapshot(newIds, p.collections);

    const message = `刷新完成：新增 ${added} 个合集${removed ? `，移除 ${removed} 个` : ''}${updated ? `，更新 ${updated} 个` : ''}`;
    return {
      excelPath,
      lastModified: this.lastModified(excelPath),
      collections: merged,
      schedules: p.schedules,
      added,
      removed,
      updated,
      message,
    };
  }

  /** 更新合集状态并保存 Excel（保存后文件变化会触发影刀 RPA 文件触发器） */
  updateStatus(collectionId: string, status: string): { ok: boolean; message: string } {
    const excelPath = this.requireExcelPath();
    const allowed = ['未开始', '待播放', '播放中', '已暂停', '待停止', '已完成'];
    const normalized = status.trim();
    if (!allowed.includes(normalized)) {
      throw new BadRequestException(`状态仅支持：${allowed.join(' / ')}`);
    }
    const count = this.updateCellByKey(excelPath, SHEET_COLLECTIONS, '合集ID', collectionId, '状态', normalized);
    if (count === 0) throw new NotFoundException('未在「合集」表中找到该合集ID：' + collectionId);
    const msg = `已将「${collectionId}」状态更新为「${normalized}」，Excel 已保存${normalized === '待播放' ? '，影刀文件触发器将检测到变化并执行播放' : ''}`;
    this.logger.log(msg);
    return { ok: true, message: msg };
  }

  /** 新增或编辑合集（按合集ID匹配，存在则更新名称/链接/总集数/备注，不存在则追加一行） */
  upsertCollection(col: { id: string; name: string; url?: string; totalEpisodes?: number; note?: string }): { ok: boolean; message: string } {
    const excelPath = this.requireExcelPath();
    if (!col.id || !col.name) throw new BadRequestException('合集ID 和 名称 不能为空');
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.readFile(excelPath);
    } catch {
      throw new BadRequestException('无法读取 Excel 文件，可能正被占用');
    }
    const idx = wb.SheetNames.findIndex((s) => s.trim() === SHEET_COLLECTIONS);
    if (idx < 0) throw new NotFoundException(`Excel 中缺少「${SHEET_COLLECTIONS}」工作表`);
    const ws = wb.Sheets[wb.SheetNames[idx]];
    const ref = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
    const headers: string[] = [];
    for (let c = ref.s.c; c <= ref.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: ref.s.r, c })];
      headers[c] = cell ? String(cell.v ?? '').trim() : '';
    }
    const colIdx = (h: string) => headers.indexOf(h);
    const idC = colIdx('合集ID');
    const nameC = colIdx('名称');
    const urlC = colIdx('链接');
    const totalC = colIdx('总集数');
    const statusC = colIdx('状态');
    const noteC = colIdx('备注');
    if (idC < 0 || nameC < 0) throw new BadRequestException('合集表缺少「合集ID」或「名称」列');

    // 查找是否已有该合集ID
    let foundRow = -1;
    for (let r = ref.s.r + 1; r <= ref.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: idC })];
      if (cell && String(cell.v ?? '').trim() === col.id) {
        foundRow = r;
        break;
      }
    }

    if (foundRow < 0) {
      // 新增一行
      foundRow = ref.e.r + 1;
      if (statusC >= 0) ws[XLSX.utils.encode_cell({ r: foundRow, c: statusC })] = { t: 's', v: '未开始' };
    }
    // 更新各列
    ws[XLSX.utils.encode_cell({ r: foundRow, c: idC })] = { t: 's', v: col.id };
    ws[XLSX.utils.encode_cell({ r: foundRow, c: nameC })] = { t: 's', v: col.name };
    if (urlC >= 0) ws[XLSX.utils.encode_cell({ r: foundRow, c: urlC })] = { t: 's', v: col.url ?? '' };
    if (totalC >= 0) ws[XLSX.utils.encode_cell({ r: foundRow, c: totalC })] = { t: 'n', v: Number(col.totalEpisodes) || 0 };
    if (noteC >= 0) ws[XLSX.utils.encode_cell({ r: foundRow, c: noteC })] = { t: 's', v: col.note ?? '' };

    ws['!ref'] = XLSX.utils.encode_range({ s: ref.s, e: { r: Math.max(ref.e.r, foundRow), c: ref.e.c } });
    try {
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(excelPath, buf);
    } catch (e) {
      const msg = (e as Error).message || '';
      if (msg.includes('EBUSY') || msg.includes('EPERM')) {
        return { ok: false, message: 'Excel 文件被占用，请关闭 Excel 后再保存' };
      }
      throw e;
    }
    return { ok: true, message: foundRow > ref.e.r ? `合集「${col.name}」已新增` : `合集「${col.name}」已更新` };
  }

  /** 删除合集（从合集表和进度表都删掉对应行） */
  deleteCollection(collectionId: string): { ok: boolean; message: string } {
    const excelPath = this.requireExcelPath();
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.readFile(excelPath);
    } catch {
      throw new BadRequestException('无法读取 Excel 文件，可能正被占用');
    }
    for (const sheetName of [SHEET_COLLECTIONS, SHEET_PROGRESS]) {
      const idx = wb.SheetNames.findIndex((s) => s.trim() === sheetName);
      if (idx < 0) continue;
      const ws = wb.Sheets[wb.SheetNames[idx]];
      const ref = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
      // 找合集ID列
      let idC = -1;
      for (let c = ref.s.c; c <= ref.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: ref.s.r, c })];
        if (cell && String(cell.v ?? '').trim() === '合集ID') { idC = c; break; }
      }
      if (idC < 0) continue;
      // 收集要保留的行
      const rows: (string | number)[][] = [];
      for (let r = ref.s.r; r <= ref.e.r; r++) {
        const rowVals: (string | number)[] = [];
        let isMatch = false;
        for (let c = ref.s.c; c <= ref.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          const v = cell ? (cell.v as string | number) : '';
          rowVals.push(v);
          if (c === idC && r > ref.s.r && String(v ?? '').trim() === collectionId) isMatch = true;
        }
        if (!isMatch) rows.push(rowVals);
      }
      const newWs = XLSX.utils.aoa_to_sheet(rows);
      wb.Sheets[wb.SheetNames[idx]] = newWs;
    }
    try {
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(excelPath, buf);
    } catch (e) {
      const msg = (e as Error).message || '';
      if (msg.includes('EBUSY') || msg.includes('EPERM')) {
        return { ok: false, message: 'Excel 文件被占用，请关闭 Excel 后再删除' };
      }
      throw e;
    }
    return { ok: true, message: `合集「${collectionId}」已删除` };
  }

  /** 保存日程（整体重写「日程」工作表，保留其他表），保存后同样触发影刀文件触发器 */
  saveSchedules(schedules: XmPlayerSchedule[]): { ok: boolean; message: string } {
    const excelPath = this.requireExcelPath();
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.readFile(excelPath);
    } catch {
      throw new BadRequestException('无法读取 Excel 文件，可能正被占用');
    }
    // 移除旧日程表（按名称）
    const existing = wb.SheetNames.filter((s) => s.trim() === SHEET_SCHEDULES);
    for (const s of existing) delete wb.Sheets[s];
    wb.SheetNames = wb.SheetNames.filter((s) => s.trim() !== SHEET_SCHEDULES);

    const header = ['时段ID', '启用', '星期', '开始时间', '结束时间', '合集ID'];
    const rows = [header];
    for (const s of schedules) {
      rows.push([
        s.id,
        s.enabled ? '是' : '否',
        Array.isArray(s.weekdays) ? s.weekdays.join('，') : '',
        s.start,
        s.end,
        s.collectionId,
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, SHEET_SCHEDULES);
    try {
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(excelPath, buf);
    } catch (e) {
      const msg = (e as Error).message || '';
      if (msg.includes('EBUSY') || msg.includes('EPERM')) {
        return { ok: false, message: 'Excel 文件被占用，请关闭 Excel 后再保存日程' };
      }
      throw e;
    }
    return { ok: true, message: `日程已保存（${schedules.length} 条），Excel 已更新` };
  }

  /** 生成示例 Excel 文件并返回内容 */
  buildExample(): Buffer {
    const wb = XLSX.utils.book_new();
    const cols = [
      ['合集ID', '名称', '链接', '总集数', '状态', '备注'],
      ['xm-001', '三国演义（儿童版）', 'https://www.ximalaya.com/album/1000001', 120, '未开始', '示例：修改状态为「待播放」并保存，会触发影刀 RPA'],
      ['xm-002', '西游记（儿童版）', 'https://www.ximalaya.com/album/1000002', 86, '播放中', '影刀播放时会回写进度'],
      ['xm-003', '成语故事大全', 'https://www.ximalaya.com/album/1000003', 50, '已完成', ''],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(cols);
    XLSX.utils.book_append_sheet(wb, ws1, SHEET_COLLECTIONS);

    const prog = [
      ['合集ID', '当前集索引', '当前集名称', '更新时间'],
      ['xm-002', 12, '第十二回 大闹天宫', '2026-10-20 08:30'],
      ['xm-003', 50, '第五十集 完', '2026-10-19 20:15'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prog), SHEET_PROGRESS);

    const sched = [
      ['时段ID', '启用', '星期', '开始时间', '结束时间', '合集ID'],
      ['s-001', '是', '周一，周三，周五', '20:00', '21:00', 'xm-001'],
      ['s-002', '是', '周六，周日', '09:30', '10:30', 'xm-002'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sched), SHEET_SCHEDULES);

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // ===== 工具 =====

  /** 浏览本地目录（无路径时列出盘符），用于前端自绘文件选择弹框 */
  browse(targetPath: string | null | undefined): XmPlayerBrowseResult {
    const root: XmPlayerBrowseResult = { path: null, parent: null, drives: [], dirs: [], files: [] };
    if (!targetPath) {
      for (let c = 65; c <= 90; c++) {
        const letter = String.fromCharCode(c);
        const p = `${letter}:\\`;
        try {
          if (fs.existsSync(p)) root.drives.push(p);
        } catch {
          /* ignore */
        }
      }
      return root;
    }
    const p = path.resolve(targetPath);
    try {
      if (!fs.existsSync(p)) throw new Error('路径不存在');
      const stat = fs.statSync(p);
      const result: XmPlayerBrowseResult = {
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
          else if (EXCEL_EXT.test(path.extname(e.name))) {
            result.files.push({ name: e.name, path: full });
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
          else if (EXCEL_EXT.test(path.extname(e.name))) {
            result.files.push({ name: e.name, path: full });
          }
        }
      }
      result.dirs.sort((a, b) => a.localeCompare(b, 'zh'));
      result.files.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
      return result;
    } catch {
      return root;
    }
  }

  /** 在指定 sheet 中按 key 列定位行并更新单元格，返回更新行数（read-modify-write，保留其余内容） */
  private updateCellByKey(
    excelPath: string,
    sheetName: string,
    keyHeader: string,
    keyValue: string,
    targetHeader: string,
    newValue: string,
  ): number {
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.readFile(excelPath);
    } catch {
      throw new BadRequestException('无法读取 Excel 文件，可能正被占用');
    }
    const idx = wb.SheetNames.findIndex((s) => s.trim() === sheetName);
    if (idx < 0) throw new NotFoundException(`Excel 中缺少「${sheetName}」工作表`);
    const ws = wb.Sheets[wb.SheetNames[idx]];
    const ref = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
    // 定位表头
    let keyCol = -1;
    let targetCol = -1;
    const headerRow = ref.s.r;
    for (let c = ref.s.c; c <= ref.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
      const v = cell ? String(cell.v ?? '').trim() : '';
      if (v === keyHeader) keyCol = c;
      if (v === targetHeader) targetCol = c;
    }
    if (keyCol < 0 || targetCol < 0) {
      throw new BadRequestException(`「${sheetName}」表中缺少列「${keyHeader}」或「${targetHeader}」`);
    }
    let updated = 0;
    for (let r = headerRow + 1; r <= ref.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: keyCol })];
      const v = cell ? String(cell.v ?? '').trim() : '';
      if (v === keyValue) {
        ws[XLSX.utils.encode_cell({ r, c: targetCol })] = { t: 's', v: newValue };
        updated++;
      }
    }
    if (updated > 0) {
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      // Excel 被占用时重试 3 次，每次间隔 800ms
      let lastErr: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          fs.writeFileSync(excelPath, buf);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e as Error;
          const msg = lastErr.message || '';
          if (msg.includes('EBUSY') || msg.includes('EPERM')) {
            // 同步等待 800ms 后重试（setTimeout 在 Nest 里异步会有问题，用同步 busy wait）
            const start = Date.now();
            while (Date.now() - start < 800) { /* busy wait */ }
            continue;
          }
          throw e;
        }
      }
      if (lastErr) throw lastErr;
    }
    return updated;
  }

  private loadSnapshot(): Snapshot | null {
    try {
      if (fs.existsSync(SNAPSHOT_FILE)) {
        return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  private saveSnapshot(ids: string[], collections: XmPlayerCollection[]): void {
    const names: Record<string, string> = {};
    for (const c of collections) names[c.id] = c.name;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      SNAPSHOT_FILE,
      JSON.stringify({ ids, names, updatedAt: new Date().toISOString() } satisfies Snapshot, null, 2),
      'utf8',
    );
  }

  private lastModified(p: string): string | undefined {
    try {
      return fs.statSync(p).mtime.toISOString();
    } catch {
      return undefined;
    }
  }

  private toNumber(v: unknown): number | undefined {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }

  private toEnabled(v: unknown): boolean {
    const s = String(v ?? '').trim();
    return s === '是' || s === '1' || s === 'true' || s === 'TRUE' || s === '启用';
  }

  private genId(): string {
    return 's-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /** 异步执行 PowerShell 脚本，返回 stdout */
  private runPowerShellScript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const tmpFile = path.resolve(process.cwd(), 'user-data', '.xm-player-pick.ps1');
      try {
        fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
        fs.writeFileSync(tmpFile, script, 'utf8');
      } catch (err) {
        reject(new BadRequestException('无法写入临时脚本'));
        return;
      }
      const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`;
      exec(cmd, { encoding: 'utf8', timeout: 300000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
        try {
          fs.unlinkSync(tmpFile);
        } catch {
          /* ignore */
        }
        if (err) {
          reject(new BadRequestException('文件选择被取消或失败'));
          return;
        }
        resolve(stdout ?? '');
      });
    });
  }
}

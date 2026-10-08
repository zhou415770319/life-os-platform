import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { JsonStore } from '@server/storage/json-store';
import * as fs from 'fs';
import * as path from 'path';

// ===== 类型定义 =====

export type BoardLevel = 'daily' | 'weekly' | 'monthly';

export interface ReviewBoardItem {
  id: string;
  text: string;
  done: boolean;
  doneAt?: string;
  createdAt: string;
}

export interface BoardSection {
  /** 来源面板 key（daily 为 YYYY-MM-DD，weekly 为 YYYY-Www） */
  key: string;
  title: string;
  content: string;
  items: ReviewBoardItem[];
  archivedAt: string;
}

export interface ReviewBoardPanel {
  id: string;
  level: BoardLevel;
  key: string;
  title: string;
  /** daily：正文 md；weekly/monthly：总结区 md（可编辑） */
  content: string;
  /** 归档快照：weekly=每日快照，monthly=每周快照 */
  sections: BoardSection[];
  /** 任务状态（daily 使用；weekly/monthly 由 sections 展平） */
  items: ReviewBoardItem[];
  archivedAt?: string;
  updatedAt: string;
  createdAt: string;
}

export interface ReviewBoardShare {
  id: string;
  token: string;
  mode: 'view' | 'edit';
  level: BoardLevel;
  key: string;
  createdAt: string;
  visits: number;
}

export interface ReviewBoardPublish {
  id: string;
  fileName: string;
  level: BoardLevel;
  key: string;
  mode: 'view' | 'edit';
  shareUrl?: string;
  createdAt: string;
}

export interface BoardView {
  panel: ReviewBoardPanel;
  /** weekly：本周尚未归档进 sections 的 daily；monthly：本月尚未归档的 weekly */
  pending: {
    key: string;
    title: string;
    content: string;
    items: ReviewBoardItem[];
  }[];
  /** 该面板覆盖的时间范围描述 */
  rangeLabel: string;
  doneCount: number;
  totalCount: number;
}

// ===== 工具函数 =====

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localMonthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** ISO 周 key：YYYY-Www */
function isoWeekKey(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad(weekNo)}`;
}

function dayKeyToWeekKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return isoWeekKey(new Date(y, m - 1, d));
}

function weekKeyRangeLabel(weekKey: string): string {
  const [y, w] = weekKey.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const dayNum = jan4.getUTCDay() || 7;
  jan4.setUTCDate(jan4.getUTCDate() + (w - 1) * 7 - (dayNum - 4));
  const start = new Date(jan4);
  const end = new Date(jan4);
  end.setUTCDate(end.getUTCDate() + 6);
  const f = (x: Date) => `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
  return `${f(start)} ~ ${f(end)}`;
}

function monthRangeLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${monthKey}-01 ~ ${monthKey}-${pad(last)}`;
}

function parseItems(content: string, existing: ReviewBoardItem[] = []): ReviewBoardItem[] {
  const lines = content.split(/\r?\n/);
  const result: ReviewBoardItem[] = [];
  const now = new Date().toISOString();
  for (const line of lines) {
    const m = line.match(/^\s*[-*+]\s*\[( |x|X)\]\s+(.+)$/);
    if (!m) continue;
    const done = m[1] !== ' ';
    const text = m[2].trim();
    if (!text) continue;
    const prev = existing.find((it) => it.text === text);
    result.push(
      prev
        ? { ...prev, done, doneAt: done && !prev.doneAt ? now : prev.doneAt }
        : { id: crypto.randomUUID(), text, done, doneAt: done ? now : undefined, createdAt: now },
    );
  }
  return result;
}

function panelTitle(level: BoardLevel, key: string): string {
  if (level === 'daily') return `${key} 复盘`;
  if (level === 'weekly') return `${key} 周复盘`;
  return `${key} 月复盘`;
}

// ===== Service =====

@Injectable()
export class ReviewBoardService implements OnModuleInit {
  private readonly logger = new Logger(ReviewBoardService.name);
  private readonly store = new JsonStore<ReviewBoardPanel>('review-board-panels.json');
  private readonly shareStore = new JsonStore<ReviewBoardShare>('review-board-shares.json');
  private readonly publishStore = new JsonStore<ReviewBoardPublish>('review-board-publishes.json');
  private timer?: NodeJS.Timeout;

  onModuleInit(): void {
    // 每 30 分钟检查一次自动归档（昨天未归档 → 周；上周未归档 → 月）
    this.timer = setInterval(() => {
      void this.autoArchive();
    }, 30 * 60 * 1000);
    this.timer.unref?.();
    this.logger.log('ReviewBoard auto-archive scheduler started');
  }

  // ===== 基础面板 =====

  private panelId(level: BoardLevel, key: string): string {
    return `${level}:${key}`;
  }

  private getRaw(level: BoardLevel, key: string): ReviewBoardPanel | null {
    return this.store.findAll().find((p) => p.id === this.panelId(level, key)) ?? null;
  }

  /** 获取面板（不存在返回空模板，不落盘） */
  getPanel(level: BoardLevel, key: string): ReviewBoardPanel {
    const raw = this.getRaw(level, key);
    if (raw) return raw;
    const now = new Date().toISOString();
    return {
      id: this.panelId(level, key),
      level,
      key,
      title: panelTitle(level, key),
      content: '',
      sections: [],
      items: [],
      updatedAt: now,
      createdAt: now,
    };
  }

  /** 保存面板内容（防抖由前端控制） */
  savePanel(level: BoardLevel, key: string, content: string): ReviewBoardPanel {
    const now = new Date().toISOString();
    const prev = this.getRaw(level, key);
    const items = parseItems(content, prev?.items ?? []);
    const panel: ReviewBoardPanel = {
      id: this.panelId(level, key),
      level,
      key,
      title: prev?.title ?? panelTitle(level, key),
      content,
      sections: prev?.sections ?? [],
      items,
      archivedAt: prev?.archivedAt,
      updatedAt: now,
      createdAt: prev?.createdAt ?? now,
    };
    this.upsertPanel(panel);
    return panel;
  }

  private upsertPanel(panel: ReviewBoardPanel): void {
    const rows = this.store.findAll();
    const idx = rows.findIndex((r) => r.id === panel.id);
    if (idx >= 0) rows[idx] = panel;
    else rows.push(panel);
    this.store.replaceAll(rows);
  }

  /** 切换任务勾选状态（daily 直接改；weekly/monthly 修改对应 section 或面板内容） */
  toggleItem(
    level: BoardLevel,
    key: string,
    itemId: string,
    done: boolean,
  ): ReviewBoardPanel {
    const panel = this.getRaw(level, key);
    if (!panel) throw new NotFoundException('面板不存在');
    const now = new Date().toISOString();
    const newItems = panel.items.map((it) =>
      it.id === itemId
        ? { ...it, done, doneAt: done ? (it.doneAt ?? now) : undefined }
        : it,
    );
    // daily：同步回写 content 中任务行的勾选状态（仅当行文本匹配）
    if (level === 'daily') {
      const target = panel.items.find((it) => it.id === itemId);
      if (target) {
        const re = new RegExp(`(^\\s*[-*+]\\s*\\[)( |x|X)(\\]\\s+${escapeRegExp(target.text)}\\s*$)`, 'm');
        panel.content = panel.content.replace(re, (_m, p1, _p2, p3) => `${p1}${done ? 'x' : ' '}${p3}`);
      }
    }
    panel.items = newItems;
    panel.updatedAt = now;
    this.upsertPanel(panel);
    return panel;
  }

  /** 修改 weekly/monthly 的总结区内容（与 savePanel 同一入口） */
  saveSummary(level: BoardLevel, key: string, content: string): ReviewBoardPanel {
    return this.savePanel(level, key, content);
  }

  /** 组装视图：面板 + 未归档子面板 + 统计 */
  getBoardView(level: BoardLevel, key: string): BoardView {
    const panel = this.getPanel(level, key);
    let pending: BoardView['pending'] = [];
    let rangeLabel = panel.title;

    if (level === 'weekly') {
      rangeLabel = weekKeyRangeLabel(key);
      // 本周尚未归档的 daily
      const days = this.listDaysInWeek(key);
      const archivedKeys = new Set(panel.sections.map((s) => s.key));
      pending = days
        .filter((d) => !archivedKeys.has(d))
        .map((d) => {
          const p = this.getPanel('daily', d);
          return { key: d, title: `${d} 复盘`, content: p.content, items: p.items };
        })
        .filter((d) => d.content.trim() !== '' || d.items.length > 0);
    } else if (level === 'monthly') {
      rangeLabel = monthRangeLabel(key);
      const weeks = this.listWeeksInMonth(key);
      const archivedKeys = new Set(panel.sections.map((s) => s.key));
      pending = weeks
        .filter((w) => !archivedKeys.has(w))
        .map((w) => {
          const p = this.getPanel('weekly', w);
          return { key: w, title: `${w} 周复盘`, content: p.content, items: this.flattenItems(p) };
        })
        .filter((w) => w.content.trim() !== '' || w.items.length > 0);
    }

    const allItems = level === 'daily' ? panel.items : this.flattenItems(panel);
    const doneCount = allItems.filter((i) => i.done).length;
    return { panel, pending, rangeLabel, doneCount, totalCount: allItems.length };
  }

  private flattenItems(panel: ReviewBoardPanel): ReviewBoardItem[] {
    const fromSections = panel.sections.flatMap((s) => s.items);
    const contentItems = parseItems(panel.content, []);
    // 合并：content 中的任务行若与归档快照文本相同则合并（保留快照 done 状态与完成时间）
    const merged = [...fromSections];
    for (const ci of contentItems) {
      const idx = merged.findIndex((m) => m.text === ci.text);
      if (idx >= 0) merged[idx] = { ...merged[idx], ...ci };
      else merged.push(ci);
    }
    return merged;
  }

  // ===== 归档 =====

  /** 手动归档：daily → 其所属周；weekly → 其所属月 */
  async archive(level: BoardLevel, key: string): Promise<{ done: boolean; message: string }> {
    if (level === 'daily') {
      this.archiveDayToWeek(key);
      return { done: true, message: `已将 ${key} 归档到周面板 ${dayKeyToWeekKey(key)}` };
    }
    if (level === 'weekly') {
      this.archiveWeekToMonth(key);
      return { done: true, message: `已将 ${key} 归档到月面板 ${this.weekKeyToMonthKey(key)}` };
    }
    throw new BadRequestException('仅支持归档 daily 或 weekly 面板');
  }

  private archiveDayToWeek(dayKey: string): void {
    const daily = this.getRaw('daily', dayKey);
    if (!daily || (daily.content.trim() === '' && daily.items.length === 0)) return;
    const weekKey = dayKeyToWeekKey(dayKey);
    const week = this.getRaw('weekly', weekKey) ?? {
      ...this.getPanel('weekly', weekKey),
      sections: [],
      items: [],
    };
    const now = new Date().toISOString();
    week.sections = week.sections.filter((s) => s.key !== dayKey);
    week.sections.push({
      key: dayKey,
      title: `${dayKey} 复盘`,
      content: daily.content,
      items: daily.items,
      archivedAt: now,
    });
    week.sections.sort((a, b) => (a.key < b.key ? -1 : 1));
    week.updatedAt = now;
    if (!daily.archivedAt) {
      daily.archivedAt = now;
      daily.updatedAt = now;
      this.upsertPanel(daily);
    }
    this.upsertPanel(week);
    this.logger.log(`Auto-archived daily ${dayKey} -> ${weekKey}`);
  }

  private archiveWeekToMonth(weekKey: string): void {
    const week = this.getRaw('weekly', weekKey);
    if (!week || (week.content.trim() === '' && week.sections.length === 0)) return;
    const monthKey = this.weekKeyToMonthKey(weekKey);
    const month = this.getRaw('monthly', monthKey) ?? {
      ...this.getPanel('monthly', monthKey),
      sections: [],
      items: [],
    };
    const now = new Date().toISOString();
    month.sections = month.sections.filter((s) => s.key !== weekKey);
    month.sections.push({
      key: weekKey,
      title: `${weekKey} 周复盘`,
      content: week.content,
      items: this.flattenItems(week),
      archivedAt: now,
    });
    month.sections.sort((a, b) => (a.key < b.key ? -1 : 1));
    month.updatedAt = now;
    if (!week.archivedAt) {
      week.archivedAt = now;
      week.updatedAt = now;
      this.upsertPanel(week);
    }
    this.upsertPanel(month);
    this.logger.log(`Auto-archived weekly ${weekKey} -> ${monthKey}`);
  }

  /** 周 key（YYYY-Www）→ 所属月份（YYYY-MM）：取该周星期一的月份 */
  private weekKeyToMonthKey(weekKey: string): string {
    const [y, w] = weekKey.split('-W').map(Number);
    const jan4 = new Date(Date.UTC(y, 0, 4));
    const dayNum = jan4.getUTCDay() || 7;
    jan4.setUTCDate(jan4.getUTCDate() + (w - 1) * 7 - (dayNum - 4));
    const monday = new Date(jan4);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() || 7) - 1));
    return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}`;
  }

  /** 自动归档：昨天未归档的 daily → 周；上周的 weekly → 月 */
  autoArchive(): { archivedDays: string[]; archivedWeeks: string[] } {
    const archivedDays: string[] = [];
    const archivedWeeks: string[] = [];
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yKey = localDateKey(yesterday);
      const yDaily = this.getRaw('daily', yKey);
      if (yDaily && !yDaily.archivedAt && (yDaily.content.trim() !== '' || yDaily.items.length > 0)) {
        this.archiveDayToWeek(yKey);
        archivedDays.push(yKey);
      }

      // 上周（周一到周日完整）：
      const today = new Date();
      const dow = today.getDay(); // 0=Sun
      if (dow === 1) {
        // 今天是周一，归档上周
        const lastMon = new Date(today);
        lastMon.setDate(today.getDate() - 7);
        const lastWeekKey = isoWeekKey(lastMon);
        const lastWeek = this.getRaw('weekly', lastWeekKey);
        if (lastWeek && !lastWeek.archivedAt) {
          this.archiveWeekToMonth(lastWeekKey);
          archivedWeeks.push(lastWeekKey);
        }
      }
    } catch (err) {
      this.logger.error(`ReviewBoard autoArchive failed: ${String(err)}`);
    }
    return { archivedDays, archivedWeeks };
  }

  // ===== 周/月范围 =====

  private listDaysInWeek(weekKey: string): string[] {
    const [y, w] = weekKey.split('-W').map(Number);
    const jan4 = new Date(Date.UTC(y, 0, 4));
    const dayNum = jan4.getUTCDay() || 7;
    jan4.setUTCDate(jan4.getUTCDate() + (w - 1) * 7 - (dayNum - 4));
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(jan4);
      d.setUTCDate(d.getUTCDate() + i);
      days.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
    }
    return days;
  }

  private listWeeksInMonth(monthKey: string): string[] {
    const [y, m] = monthKey.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    const weeks = new Set<string>();
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      weeks.add(isoWeekKey(new Date(d)));
    }
    return Array.from(weeks).sort();
  }

  // ===== 分享链接 =====

  createShareLink(level: BoardLevel, key: string, mode: 'view' | 'edit'): ReviewBoardShare {
    const existing = this.shareStore
      .findAll()
      .find((s) => s.level === level && s.key === key && s.mode === mode);
    if (existing) return existing;
    const share: ReviewBoardShare = {
      id: crypto.randomUUID(),
      token: `${mode === 'edit' ? 'e' : 'v'}${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`,
      mode,
      level,
      key,
      createdAt: new Date().toISOString(),
      visits: 0,
    };
    this.shareStore.create(share);
    return share;
  }

  getShares(): ReviewBoardShare[] {
    return this.shareStore.findAll().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  deleteShare(id: string): void {
    const removed = this.shareStore.remove(id);
    if (!removed) throw new NotFoundException('分享不存在');
  }

  getShareByToken(token: string): ReviewBoardShare | null {
    return this.shareStore.findAll().find((s) => s.token === token) ?? null;
  }

  /** 公开访问：view 只读数据；edit 数据 + 可写标记 */
  getPublicShareData(token: string): {
    mode: 'view' | 'edit';
    level: BoardLevel;
    key: string;
    title: string;
    rangeLabel: string;
    content: string;
    items: ReviewBoardItem[];
    sections: BoardSection[];
  } {
    const share = this.getShareByToken(token);
    if (!share) throw new NotFoundException('分享链接不存在或已失效');
    share.visits += 1;
    this.shareStore.update(share.id, { visits: share.visits });
    const view = this.getBoardView(share.level, share.key);
    return {
      mode: share.mode,
      level: share.level,
      key: share.key,
      title: view.panel.title,
      rangeLabel: view.rangeLabel,
      content: view.panel.content,
      items: share.level === 'daily' ? view.panel.items : this.flattenItems(view.panel),
      sections: view.panel.sections,
    };
  }

  /** 公开可编辑：edit token 勾选状态写回 */
  updatePublicItem(
    token: string,
    itemId: string,
    done: boolean,
  ): { ok: boolean; item: ReviewBoardItem | null } {
    const share = this.getShareByToken(token);
    if (!share) throw new NotFoundException('分享链接不存在或已失效');
    if (share.mode !== 'edit') throw new BadRequestException('只读链接不允许修改');
    const now = new Date().toISOString();

    if (share.level === 'daily') {
      const panel = this.getRaw('daily', share.key);
      if (!panel) throw new NotFoundException('面板不存在');
      const item = panel.items.find((it) => it.id === itemId);
      if (!item) return { ok: false, item: null };
      item.done = done;
      item.doneAt = done ? (item.doneAt ?? now) : undefined;
      // 同步回写 content 行
      const re = new RegExp(`(^\\s*[-*+]\\s*\\[)( |x|X)(\\]\\s+${escapeRegExp(item.text)}\\s*$)`, 'm');
      panel.content = panel.content.replace(re, (_m, p1, _p2, p3) => `${p1}${done ? 'x' : ' '}${p3}`);
      panel.updatedAt = now;
      this.upsertPanel(panel);
      return { ok: true, item };
    }

    // weekly/monthly：写回对应 section 或 content 中的任务
    const panel = this.getRaw(share.level, share.key);
    if (!panel) throw new NotFoundException('面板不存在');
    for (const section of panel.sections) {
      const item = section.items.find((it) => it.id === itemId);
      if (item) {
        item.done = done;
        item.doneAt = done ? (item.doneAt ?? now) : undefined;
        panel.updatedAt = now;
        this.upsertPanel(panel);
        return { ok: true, item };
      }
    }
    // 总结区任务行
    const item = panel.items.find((it) => it.id === itemId);
    if (item) {
      item.done = done;
      item.doneAt = done ? (item.doneAt ?? now) : undefined;
      panel.updatedAt = now;
      this.upsertPanel(panel);
      return { ok: true, item };
    }
    return { ok: false, item: null };
  }

  // ===== ShareOne 发布包 =====

  /** 导出为自包含 HTML 发布包（可交给 ShareOne 发布公网短链） */
  exportPublishBundle(
    level: BoardLevel,
    key: string,
    mode: 'view' | 'edit',
  ): ReviewBoardPublish {
    const view = this.getBoardView(level, key);
    const html = this.renderPublishHtml(view, mode, key);
    const dir = path.join(process.env.STORAGE_DATA_DIR || path.join(process.cwd(), 'user-data'), 'publish');
    fs.mkdirSync(dir, { recursive: true });
    const fileName = `review-board-${level}-${key}-${mode}.html`;
    fs.writeFileSync(path.join(dir, fileName), html, 'utf-8');
    const publish: ReviewBoardPublish = {
      id: crypto.randomUUID(),
      fileName,
      level,
      key,
      mode,
      createdAt: new Date().toISOString(),
    };
    this.publishStore.create(publish);
    return publish;
  }

  getPublishes(): ReviewBoardPublish[] {
    return this.publishStore.findAll().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  /** 更新发布的 ShareOne 链接（发布成功后回填） */
  setPublishShareUrl(id: string, shareUrl: string): void {
    const pub = this.publishStore.update(id, { shareUrl });
    if (!pub) throw new NotFoundException('发布记录不存在');
  }

  /** 批量删除发布记录，并清理不再被任何记录引用的孤儿发布文件 */
  deletePublishes(ids: string[]): { deleted: number } {
    const all = this.publishStore.findAll();
    const remaining = all.filter((p) => !ids.includes(p.id));
    this.publishStore.replaceAll(remaining);
    // 清理未被任何剩余记录引用的发布文件（只清理本插件生成的 review-board-*.html）
    const dir = this.getPublishDir();
    const usedFiles = new Set(remaining.map((p) => p.fileName));
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('review-board-') && f.endsWith('.html') && !usedFiles.has(f)) {
        try {
          fs.unlinkSync(path.join(dir, f));
        } catch {
          /* 忽略单个文件清理失败 */
        }
      }
    }
    return { deleted: all.length - remaining.length };
  }

  /** 本地发布目录路径 */
  getPublishDir(): string {
    return path.join(process.env.STORAGE_DATA_DIR || path.join(process.cwd(), 'user-data'), 'publish');
  }

  /** 读取发布包文件内容（供链接直接访问，防路径穿越） */
  getPublishFile(fileName: string): { content: string; contentType: string } {
    if (!/^review-board-[a-z]+-[\w.-]+-(view|edit)\.html$/.test(fileName)) {
      throw new BadRequestException('非法文件名');
    }
    const dir = this.getPublishDir();
    const full = path.join(dir, fileName);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      throw new NotFoundException('发布包不存在');
    }
    return { content: fs.readFileSync(full, 'utf-8'), contentType: 'text/html; charset=utf-8' };
  }

  // ===== HTML 渲染（发布包用）=====

  private renderPublishHtml(view: BoardView, mode: 'view' | 'edit', key: string): string {
    const data = {
      title: view.panel.title,
      rangeLabel: view.rangeLabel,
      content: view.panel.content,
      items: view.panel.items,
      sections: view.panel.sections,
      mode,
      key,
      level: view.panel.level,
    };
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(data.title)} · 人生系统助手复盘面板</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: #0b0e14; color: #e2e8f0; line-height: 1.7; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 32px 20px 64px; }
  .head { border-bottom: 1px solid rgba(255,255,255,.08); padding-bottom: 16px; margin-bottom: 24px; }
  .head h1 { font-size: 22px; color: #f8fafc; }
  .head .sub { color: #94a3b8; font-size: 13px; margin-top: 6px; }
  .badge { display: inline-block; font-size: 11px; padding: 2px 10px; border-radius: 999px; margin-left: 8px; vertical-align: middle; }
  .badge-view { background: rgba(56,189,248,.15); color: #38bdf8; }
  .badge-edit { background: rgba(52,211,153,.15); color: #34d399; }
  .card { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; }
  .card h2 { font-size: 15px; color: #cbd5e1; margin-bottom: 10px; font-weight: 600; }
  .md h1, .md h2, .md h3 { color: #f1f5f9; margin: 18px 0 8px; }
  .md h1 { font-size: 20px; } .md h2 { font-size: 17px; } .md h3 { font-size: 15px; }
  .md p { margin: 8px 0; }
  .md ul, .md ol { padding-left: 22px; margin: 8px 0; }
  .md li { margin: 3px 0; }
  .md blockquote { border-left: 3px solid #6366f1; padding-left: 12px; color: #94a3b8; margin: 8px 0; }
  .md code { background: rgba(255,255,255,.08); padding: 1px 6px; border-radius: 4px; font-size: 13px; font-family: ui-monospace, Consolas, monospace; }
  .md pre { background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.06); border-radius: 8px; padding: 12px; overflow-x: auto; margin: 10px 0; }
  .md pre code { background: none; padding: 0; }
  .md a { color: #38bdf8; text-decoration: none; }
  .md hr { border: none; border-top: 1px solid rgba(255,255,255,.08); margin: 16px 0; }
  .task { display: flex; align-items: flex-start; gap: 10px; padding: 7px 10px; border-radius: 8px; cursor: ${mode === 'edit' ? 'pointer' : 'default'}; }
  .task:hover { background: rgba(255,255,255,.04); }
  .task.done .ttext { text-decoration: line-through; color: #64748b; }
  .box { width: 18px; height: 18px; border: 2px solid #475569; border-radius: 5px; flex: none; margin-top: 3px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #0b0e14; }
  .task.done .box { background: #34d399; border-color: #34d399; }
  .task.done .box::after { content: "✓"; }
  .ttext { flex: 1; font-size: 14px; }
  .ttime { font-size: 11px; color: #64748b; margin-left: 8px; }
  .stat { display: flex; gap: 20px; margin: 10px 0 4px; font-size: 13px; color: #94a3b8; }
  .stat b { color: #34d399; }
  .foot { color: #475569; font-size: 11px; text-align: center; margin-top: 32px; }
  .submit-bar { position: sticky; bottom: 0; background: rgba(11,14,20,.92); backdrop-filter: blur(8px); border-top: 1px solid rgba(255,255,255,.08); padding: 12px 20px; margin: 0 -20px -18px; border-radius: 0 0 12px 12px; }
  .submit-btn { width: 100%; background: linear-gradient(135deg,#6366f1,#8b5cf6); border: none; color: #fff; font-size: 14px; font-weight: 600; padding: 10px; border-radius: 8px; cursor: pointer; }
  .submit-btn:hover { opacity: .9; }
  .sync-hint { font-size: 12px; color: #94a3b8; margin-top: 8px; line-height: 1.6; }
  .sync-hint code { background: rgba(255,255,255,.08); padding: 1px 5px; border-radius: 4px; font-size: 11px; word-break: break-all; }
  .empty { color: #64748b; font-size: 13px; text-align: center; padding: 30px 0; }
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <h1>${escapeHtml(data.title)} <span class="badge ${mode === 'edit' ? 'badge-edit' : 'badge-view'}">${mode === 'edit' ? '可编辑' : '只读'}</span></h1>
    <div class="sub">${escapeHtml(data.rangeLabel)} · 由人生系统助手生成</div>
  </div>

  <div class="card">
    <div class="stat">已完成 <b id="doneCount">0</b> / <span id="totalCount">0</span> 项</div>
    <div id="taskList"></div>
    <div id="emptyTip" class="empty" style="display:none;">暂无任务，快去记录吧</div>
  </div>

  ${data.sections.length > 0 ? `<div class="card"><h2>📁 归档明细</h2><div id="sections"></div></div>` : ''}

  <div class="card"><h2>📝 正文</h2><div id="mdContent" class="md"></div></div>

  ${mode === 'edit' ? `
  <div class="card submit-bar">
    <button class="submit-btn" onclick="submitStatus()">提交状态变更</button>
    <div class="sync-hint" id="syncHint" style="display:none;">
      请复制以下文本，粘贴到本分享链接页面的<b>评论区</b>提交（ShareOne 评论协同）。本机侧会拉取评论并应用状态。<br>
      <code id="syncText"></code>
    </div>
  </div>` : ''}

  <div class="foot">Life-OS 复盘面板 · ShareOne 发布</div>
</div>

<script>
(function () {
  var DATA = ${JSON.stringify(data)};
  var changed = [];

  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function inlineMd(t) {
    return t
      .replace(/\\*\\*([^*]+)\\*\\*/g, '<b>$1</b>')
      .replace(/\\*([^*]+)\\*/g, '<i>$1</i>')
      .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
      .replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function mdToHtml(md) {
    if (!md) return '<div class="empty">（暂无内容）</div>';
    var lines = md.split(/\\r?\\n/);
    var out = [], inCode = false, codeBuf = [], listType = null;
    function closeList() { if (listType) { out.push('</' + listType + '>'); listType = null; } }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var codeM = line.match(/^\`\`\`/);
      if (codeM) {
        if (inCode) { out.push('<pre><code>' + esc(codeBuf.join('\\n')) + '</code></pre>'); codeBuf = []; inCode = false; }
        else { closeList(); inCode = true; }
        continue;
      }
      if (inCode) { codeBuf.push(line); continue; }
      var taskM = line.match(/^\\s*[-*+]\\s*\\[( |x|X)\\]\\s+(.+)$/);
      if (taskM) { closeList(); out.push('<div class="task' + (taskM[1] !== ' ' ? ' done' : '') + '"><span class="box"></span><span class="ttext">' + inlineMd(esc(taskM[2])) + '</span></div>'); continue; }
      var liM = line.match(/^\\s*[-*+]\\s+(.+)$/);
      if (liM) { if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; } out.push('<li>' + inlineMd(esc(liM[1])) + '</li>'); continue; }
      var olM = line.match(/^\\s*\\d+\\.\\s+(.+)$/);
      if (olM) { if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; } out.push('<li>' + inlineMd(esc(olM[1])) + '</li>'); continue; }
      closeList();
      var h = line.match(/^(#{1,6})\\s+(.+)$/);
      if (h) { var n = h[1].length; out.push('<h' + n + '>' + inlineMd(esc(h[2])) + '</h' + n + '>'); continue; }
      var q = line.match(/^>\\s?(.*)$/);
      if (q) { out.push('<blockquote>' + inlineMd(esc(q[1])) + '</blockquote>'); continue; }
      if (/^---+$/.test(line)) { out.push('<hr>'); continue; }
      if (line.trim() === '') { out.push(''); continue; }
      out.push('<p>' + inlineMd(esc(line)) + '</p>');
    }
    closeList();
    if (inCode) out.push('<pre><code>' + esc(codeBuf.join('\\n')) + '</code></pre>');
    return out.join('\\n');
  }

  function renderTasks() {
    var list = document.getElementById('taskList');
    var empty = document.getElementById('emptyTip');
    var done = 0;
    list.innerHTML = '';
    var items = DATA.items || [];
    items.forEach(function (it) {
      if (it.done) done++;
      var div = document.createElement('div');
      div.className = 'task' + (it.done ? ' done' : '');
      div.innerHTML = '<span class="box"></span><span class="ttext">' + esc(it.text) + (it.doneAt ? '<span class="ttime">✓ ' + new Date(it.doneAt).toLocaleString('zh-CN') + '</span>' : '') + '</span>';
      if (DATA.mode === 'edit') {
        div.onclick = function () {
          it.done = !it.done;
          if (it.done && !it.doneAt) it.doneAt = new Date().toISOString();
          if (!it.done) it.doneAt = undefined;
          var idx = changed.findIndex(function (c) { return c.id === it.id; });
          if (idx >= 0) changed.splice(idx, 1);
          changed.push({ id: it.id, done: it.done });
          renderTasks();
        };
      }
      list.appendChild(div);
    });
    document.getElementById('doneCount').textContent = done;
    document.getElementById('totalCount').textContent = items.length;
    empty.style.display = items.length ? 'none' : '';
  }

  function renderSections() {
    var el = document.getElementById('sections');
    if (!el) return;
    el.innerHTML = '';
    (DATA.sections || []).forEach(function (s) {
      var card = document.createElement('div');
      card.style.cssText = 'border-top:1px solid rgba(255,255,255,.06);padding:10px 0;';
      card.innerHTML = '<div style="font-weight:600;color:#94a3b8;font-size:13px;margin-bottom:6px;">' + esc(s.title) + '</div>' + mdToHtml(s.content);
      el.appendChild(card);
    });
  }

  function submitStatus() {
    var hint = document.getElementById('syncHint');
    var text = document.getElementById('syncText');
    if (changed.length === 0) { alert('还没有变更的状态'); return; }
    var payload = { key: DATA.key, level: DATA.level, items: changed, ts: new Date().toISOString() };
    var str = '##REVIEWBOARD_STATUS## ' + JSON.stringify(payload);
    text.textContent = str;
    hint.style.display = 'block';
  }

  document.getElementById('mdContent').innerHTML = mdToHtml(DATA.content);
  renderTasks();
  renderSections();
  window.submitStatus = submitStatus;
})();
</script>
</body>
</html>`;
  }
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JsonStore } from '@server/storage/json-store';
import { InsightsService } from '@server/modules/insights/insights.service';
import { NotesService } from '@server/modules/notes/notes.service';
import { LifeLogService } from '@server/modules/life-log/life-log.service';
import { LocalCapabilityService } from '@server/platform-local/local-capability.service';

export type ReviewType = 'daily' | 'weekly';

export interface ReviewRecord {
  id: string;
  date: string;
  type: ReviewType;
  title: string;
  summary: string;
  source: 'ai' | 'template';
  stats: {
    habitCompleted: number;
    habitTotal: number;
    focusMinutes: number;
    focusCount: number;
    wastedMinutes: number;
    wastedCategories: { category: string; minutes: number }[];
    notesAdded: number;
    logEvents: number;
    goals: { title: string; progress: number }[];
  };
  createdAt: string;
}

export interface ReviewSettings {
  /** 每日复盘提醒开关 */
  dailyReminderEnabled: boolean;
  /** 每日提醒时间 HH:mm */
  dailyReminderTime: string;
  /** 每周复盘提醒开关 */
  weeklyReminderEnabled: boolean;
  /** 每周复盘提醒：星期几 0-6（0=周日） */
  weeklyReminderDay: number;
  /** 每周提醒时间 HH:mm */
  weeklyReminderTime: string;
  /** 到点是否自动生成复盘 */
  autoGenerateEnabled: boolean;
}

const DEFAULT_SETTINGS: ReviewSettings = {
  dailyReminderEnabled: false,
  dailyReminderTime: '21:00',
  weeklyReminderEnabled: false,
  weeklyReminderDay: 0,
  weeklyReminderTime: '20:00',
  autoGenerateEnabled: true,
};

const CATEGORY_LABEL: Record<string, string> = {
  idle: '发呆',
  shortvideo: '刷短视频',
  gossip: '八卦闲聊',
  other: '其他',
};

@Injectable()
export class ReviewService implements OnModuleInit {
  private readonly logger = new Logger(ReviewService.name);
  private readonly store = new JsonStore<ReviewRecord>('review-records.json');
  private readonly settingsStore = new JsonStore<{ id: string; settings: ReviewSettings }>(
    'review-settings.json',
  );
  private readonly blackholeStore = new JsonStore<{
    id: string;
    category: string;
    durationMinutes: number;
    recordDate: string;
  }>('time-blackhole-records.json');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly insightsService: InsightsService,
    private readonly notesService: NotesService,
    private readonly lifeLogService: LifeLogService,
    private readonly capability: LocalCapabilityService,
  ) {}

  onModuleInit(): void {
    // 每 30 秒检查一次提醒/自动生成
    this.timer = setInterval(() => {
      void this.checkSchedule();
    }, 30_000);
    this.timer.unref?.();
    this.logger.log('Review reminder scheduler started');
  }

  // ===== 设置 =====

  getSettings(): ReviewSettings {
    const rows = this.settingsStore.findAll();
    const row = rows[0];
    return { ...DEFAULT_SETTINGS, ...(row?.settings ?? {}) };
  }

  saveSettings(patch: Partial<ReviewSettings>): ReviewSettings {
    const current = this.getSettings();
    const next = { ...current, ...patch };
    const rows = this.settingsStore.findAll();
    if (rows.length === 0) {
      this.settingsStore.create({ id: crypto.randomUUID(), settings: next });
    } else {
      this.settingsStore.update(rows[0].id, { settings: next });
    }
    return next;
  }

  // ===== 数据聚合 =====

  /** 聚合某天数据快照（用于复盘展示与生成） */
  private async buildSnapshot(dateStr: string, days: 1 | 7) {
    const summary = await this.insightsService.getSummary();

    // 习惯：days=1 取当日；days=7 取近 7 天
    const heatmap = summary.habitHeatmap;
    const startIdx = heatmap.findIndex((h) => h.date === dateStr);
    const range = days === 1
      ? [dateStr]
      : heatmap.slice(Math.max(0, startIdx - 6), startIdx + 1).map((h) => h.date);

    const habitCompleted = heatmap
      .filter((h) => range.includes(h.date))
      .reduce((s, h) => s + h.count, 0);
    const habitTotal = summary.habitStats.filter((h) => h.frequency === 'daily').length;

    // 番茄
    const pomoRange = summary.pomodoroDaily.filter((p) => range.includes(p.date));
    const focusMinutes = pomoRange.reduce((s, p) => s + p.minutes, 0);
    // 用近 7 天有专注的天数估算次数
    const focusCount = days === 1 ? summary.pomodoroTotal.count : pomoRange.filter((p) => p.minutes > 0).length;

    // 时间黑洞：按 range 日期精确聚合（分钟与分类一致）；需插件开启「参与数据分析」才纳入
    const bhRows = summary.blackholeAnalysisEnabled
      ? this.blackholeStore.findAll().filter((b) => range.includes(b.recordDate))
      : [];
    const wastedMinutes = bhRows.reduce((s, b) => s + b.durationMinutes, 0);
    const bhCatMap = new Map<string, number>();
    for (const b of bhRows) {
      bhCatMap.set(b.category, (bhCatMap.get(b.category) ?? 0) + b.durationMinutes);
    }
    const wastedCategories = Array.from(bhCatMap.entries()).map(([category, minutes]) => ({
      category,
      minutes,
    }));

    // 笔记：取创建日期匹配的（findAllNotes 无日期筛选，取前 200 条过滤）
    let notesAdded = 0;
    try {
      const notes = await this.notesService.findAllNotes(1, 200);
      notesAdded = notes.items.filter((n) => n.createdAt.slice(0, 10) === dateStr).length;
    } catch {
      notesAdded = 0;
    }

    // 人生日志：当日/近 7 天事件数
    let logEvents = 0;
    try {
      const startDate = new Date(`${dateStr}T00:00:00`);
      startDate.setDate(startDate.getDate() - (days - 1));
      const logs = await this.lifeLogService.findAll({
        startDate: startDate.toISOString().slice(0, 10),
        endDate: dateStr,
        page: 1,
        pageSize: 1,
      });
      logEvents = logs.total;
    } catch {
      logEvents = 0;
    }

    // 插件数据：仅统计已在插件设置中开启「参与数据分析」的插件
    const pluginData =
      summary.pluginStats && summary.pluginStats.length > 0
        ? summary.pluginStats
            .map((p) => `${p.name}（${p.label} ${p.value}${p.detail ? `，${p.detail}` : ''}）`)
            .join('；')
        : '';

    return {
      date: dateStr,
      habitCompleted,
      habitTotal,
      focusMinutes,
      focusCount,
      wastedMinutes,
      wastedCategories: wastedCategories.map((c) => ({
        category: c.category,
        minutes: c.minutes,
      })),
      notesAdded,
      logEvents,
      goals: summary.goalStats.map((g) => ({ title: g.title, progress: g.progress })),
      pluginData,
    };
  }

  // ===== 生成复盘 =====

  async generate(type: ReviewType, dateStr?: string): Promise<ReviewRecord> {
    const target = dateStr || new Date().toISOString().slice(0, 10);
    const days: 1 | 7 = type === 'daily' ? 1 : 7;
    const stats = await this.buildSnapshot(target, days);

    // 1) 尝试 AI 生成个性化总结
    let summary = '';
    let source: 'ai' | 'template' = 'template';
    try {
      summary = await this.generateWithAi(type, stats);
      if (summary && summary.trim()) {
        source = 'ai';
      }
    } catch (err) {
      this.logger.warn(`AI review fallback to template: ${String(err)}`);
    }

    if (!summary || !summary.trim()) {
      summary = this.buildTemplateSummary(type, stats);
    }

    const record: ReviewRecord = {
      id: crypto.randomUUID(),
      date: target,
      type,
      title: type === 'daily' ? `${target} 每日复盘` : `${target} 周度复盘`,
      summary,
      source,
      stats,
      createdAt: new Date().toISOString(),
    };
    this.store.create(record);
    this.logger.log(`Review generated: ${record.title} (${source})`);
    return record;
  }

  private async generateWithAi(
    type: ReviewType,
    stats: Awaited<ReturnType<ReviewService['buildSnapshot']>>,
  ): Promise<string> {
    const typeLabel = type === 'daily' ? '每日' : '每周';
    const wasteText =
      stats.wastedCategories.length > 0
        ? stats.wastedCategories
            .map((c) => `${CATEGORY_LABEL[c.category] ?? c.category} ${c.minutes} 分钟`)
            .join('、')
        : '无';
    const goalText =
      stats.goals.length > 0
        ? stats.goals.map((g) => `${g.title}（${g.progress}%）`).join('；')
        : '无进行中目标';

    const dataText = [
      `日期：${stats.date}`,
      `习惯打卡：${stats.habitCompleted}/${stats.habitTotal || '—'}`,
      `番茄专注：${stats.focusMinutes} 分钟（${stats.focusCount} 次）`,
      `浪费时间：${stats.wastedMinutes} 分钟（${wasteText}）`,
      `新增笔记：${stats.notesAdded} 条`,
      `人生日志事件：${stats.logEvents} 条`,
      `目标进度：${goalText}`,
      ...(stats.pluginData ? [`插件数据：${stats.pluginData}`] : []),
    ].join('\n');

    const result = await this.capability.load('textGenerate').call('textGenerate', {
      system_context:
        '你是一位温和、具体、不说教的人生复盘教练。根据用户当天/本周的数据，用 3-6 句话做复盘：先肯定做得好的，再指出 1 个可改进点，最后给出 1 条明天/下周的具体小行动建议。语气自然、有人情味，不要堆砌列表，不要用"亲""宝"等称呼。',
      user_question: `请基于以下数据生成一份${typeLabel}复盘总结（纯文字，不要 Markdown 标题）：\n${dataText}`,
    });
    return result.content ?? '';
  }

  private buildTemplateSummary(
    type: ReviewType,
    stats: Awaited<ReturnType<ReviewService['buildSnapshot']>>,
  ): string {
    const typeLabel = type === 'daily' ? '每日' : '每周';
    const lines: string[] = [];
    lines.push(`${stats.date} ${typeLabel}复盘`);
    lines.push(
      `习惯打卡 ${stats.habitCompleted} 次${stats.habitTotal ? `（今日应打卡 ${stats.habitTotal} 项）` : ''}`,
    );
    lines.push(
      `番茄专注 ${stats.focusMinutes} 分钟${stats.focusCount ? `（${stats.focusCount} 次）` : ''}`,
    );
    if (stats.wastedMinutes > 0) {
      lines.push(
        `浪费时间 ${stats.wastedMinutes} 分钟（${
          stats.wastedCategories.length > 0
            ? stats.wastedCategories
                .map((c) => `${CATEGORY_LABEL[c.category] ?? c.category} ${c.minutes} 分钟`)
                .join('、')
            : '待记录'
        }）`,
      );
    } else {
      lines.push('浪费时间 0 分钟，太棒了');
    }
    lines.push(`新增笔记 ${stats.notesAdded} 条，日志事件 ${stats.logEvents} 条`);
    if (stats.goals.length > 0) {
      const top = stats.goals[0];
      lines.push(`当前重点目标：${top.title}（${top.progress}%）`);
    }
    lines.push(
      stats.focusMinutes >= stats.wastedMinutes && stats.focusMinutes > 0
        ? '一句话：今天专注大于浪费，继续保持节奏。'
        : stats.wastedMinutes > 0
          ? '一句话：留意时间黑洞，明天从减少浪费开始。'
          : '一句话：数据还不多，先动起来，明天继续。',
    );
    return lines.join('\n');
  }

  // ===== 查询 =====

  async list(): Promise<{ items: ReviewRecord[]; total: number }> {
    const rows = this.store.findAll();
    const sorted = rows.sort((a, b) => (a.date < b.date ? 1 : -1));
    return { items: sorted, total: sorted.length };
  }

  /** 今日状态：是否已生成、是否到提醒时间 */
  async getToday(): Promise<{
    date: string;
    hasRecord: boolean;
    shouldRemind: boolean;
    record: ReviewRecord | null;
    settings: ReviewSettings;
  }> {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const settings = this.getSettings();
    const rows = this.store.findAll();
    const record = rows.find((r) => r.date === today && r.type === 'daily') ?? null;

    let shouldRemind = false;
    if (settings.dailyReminderEnabled && !record) {
      const [h, m] = settings.dailyReminderTime.split(':').map(Number);
      const remindAt = new Date(now);
      remindAt.setHours(h ?? 21, m ?? 0, 0, 0);
      shouldRemind = now.getTime() >= remindAt.getTime();
    }

    return { date: today, hasRecord: !!record, shouldRemind, record, settings };
  }

  /** 定时调度：到点自动生成复盘 */
  private async checkSchedule(): Promise<void> {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date();
      const settings = this.getSettings();
      const rows = this.store.findAll();

      // 每日
      if (settings.dailyReminderEnabled && settings.autoGenerateEnabled) {
        const hasDaily = rows.some((r) => r.date === today && r.type === 'daily');
        if (!hasDaily) {
          const [h, m] = settings.dailyReminderTime.split(':').map(Number);
          const remindAt = new Date(now);
          remindAt.setHours(h ?? 21, m ?? 0, 0, 0);
          if (now.getTime() >= remindAt.getTime()) {
            this.logger.log(`Auto generating daily review for ${today}`);
            await this.generate('daily', today);
          }
        }
      }

      // 每周
      if (settings.weeklyReminderEnabled && settings.autoGenerateEnabled) {
        const day = settings.weeklyReminderDay ?? 0;
        const isDay = now.getDay() === day;
        if (isDay) {
          // 本周一作为周起始标识
          const monday = new Date(now);
          const offset = (now.getDay() + 6) % 7;
          monday.setDate(now.getDate() - offset);
          const weekKey = monday.toISOString().slice(0, 10);
          const hasWeekly = rows.some(
            (r) => r.type === 'weekly' && r.date >= weekKey && r.date <= today,
          );
          if (!hasWeekly) {
            const [h, m] = settings.weeklyReminderTime.split(':').map(Number);
            const remindAt = new Date(now);
            remindAt.setHours(h ?? 20, m ?? 0, 0, 0);
            if (now.getTime() >= remindAt.getTime()) {
              this.logger.log(`Auto generating weekly review for ${today}`);
              await this.generate('weekly', today);
            }
          }
        }
      }
    } catch (err) {
      this.logger.error(`Review schedule check failed: ${String(err)}`);
    }
  }
}

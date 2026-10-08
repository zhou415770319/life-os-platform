import { Inject, Injectable, Logger } from '@nestjs/common';
import { LOCAL_DATABASE } from '@server/storage/local-database.module';
import type { LocalDatabase } from '@server/storage/local-database';
import { desc } from '@server/storage/drizzle-compat';
import { lifeGoals, lifeHabits, lifeHabitRecords } from '@server/database/schema';
import { JsonStore } from '@server/storage/json-store';
import { ChildResourcesService } from '@server/modules/child-resources/child-resources.service';
import { RpaManagerService } from '@server/modules/rpa-manager/rpa-manager.service';

interface PomodoroRecord {
  id: string;
  taskName: string;
  durationMinutes: number;
  startedAt: string;
  completedAt: string;
  abandoned: boolean;
}

interface TimeBlackholeRecord {
  id: string;
  category: string;
  note?: string;
  durationMinutes: number;
  recordDate: string;
  createdAt: string;
}

function dateRange(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);
  private readonly pomodoroStore = new JsonStore<PomodoroRecord>('pomodoro-records.json');
  private readonly blackholeStore = new JsonStore<TimeBlackholeRecord>('time-blackhole-records.json');
  private readonly pluginConfigStore = new JsonStore<{ id: string; pluginKey: string; enabled: boolean; config?: Record<string, unknown> }>(
    'life-plugin-config.json',
  );

  constructor(
    @Inject(LOCAL_DATABASE) private readonly db: LocalDatabase,
    private readonly childResourcesService: ChildResourcesService,
    private readonly rpaManagerService: RpaManagerService,
  ) {}

  /**
   * 判断插件是否已开启「参与数据分析」：插件启用且 analysisEnabled === true。
   */
  private isAnalysisEnabled(pluginKey: string): boolean {
    const row = this.pluginConfigStore
      .findAll()
      .find((p) => p.pluginKey === pluginKey);
    return !!row && row.enabled && (row.config as Record<string, unknown> | undefined)?.analysisEnabled === true;
  }

  /**
   * 聚合已开启「参与数据分析」的插件数据。
   * 规则：插件需在设置中启用并打开「参与数据分析」开关，才会纳入数据洞察与自动复盘；
   * 未设置一律不分析。
   */
  async buildPluginStats(): Promise<
    { pluginKey: string; name: string; label: string; value: string; detail?: string }[]
  > {
    const rows = this.pluginConfigStore.findAll();
    const enabledForAnalysis = rows.filter(
      (p) => p.enabled && (p.config as Record<string, unknown> | undefined)?.analysisEnabled === true,
    );
    if (enabledForAnalysis.length === 0) return [];

    const stats: { pluginKey: string; name: string; label: string; value: string; detail?: string }[] = [];
    for (const plugin of enabledForAnalysis) {
      try {
        switch (plugin.pluginKey) {
          case 'dsh-plugin-child-resources': {
            const list = await this.childResourcesService.findAll({ page: 1, pageSize: 1 });
            const categories = await this.childResourcesService.getCategories();
            stats.push({
              pluginKey: plugin.pluginKey,
              name: '儿童资料站',
              label: '资料数量',
              value: `${list.total} 条`,
              detail: `覆盖 ${categories.items.length} 个分类`,
            });
            break;
          }
          case 'dsh-plugin-rpa-manager': {
            const files = this.rpaManagerService.listFiles();
            stats.push({
              pluginKey: plugin.pluginKey,
              name: 'RPA 管理',
              label: '管理文件数',
              value: `${files.total} 个`,
              detail: '本地文件夹/Excel 文件',
            });
            break;
          }
          case 'dsh-plugin-pomodoro': {
            const pomoRows = this.pomodoroStore.findAll().filter((r) => !r.abandoned);
            const minutes = pomoRows.reduce((s, r) => s + r.durationMinutes, 0);
            stats.push({
              pluginKey: plugin.pluginKey,
              name: '番茄钟记录',
              label: '专注时长',
              value: `${minutes} 分钟`,
              detail: `共 ${pomoRows.length} 次专注`,
            });
            break;
          }
          case 'dsh-plugin-time-blackhole': {
            const bhRows = this.blackholeStore.findAll();
            const minutes = bhRows.reduce((s, r) => s + r.durationMinutes, 0);
            stats.push({
              pluginKey: plugin.pluginKey,
              name: '时间黑洞',
              label: '浪费时间',
              value: `${minutes} 分钟`,
              detail: `共 ${bhRows.length} 条记录`,
            });
            break;
          }
          default:
            stats.push({
              pluginKey: plugin.pluginKey,
              name: plugin.pluginKey.replace(/^dsh-plugin-/, ''),
              label: '数据',
              value: '暂未接入',
            });
        }
      } catch (err) {
        this.logger.warn(`buildPluginStats failed for ${plugin.pluginKey}: ${String(err)}`);
        stats.push({
          pluginKey: plugin.pluginKey,
          name: plugin.pluginKey.replace(/^dsh-plugin-/, ''),
          label: '数据',
          value: '获取失败',
        });
      }
    }
    return stats;
  }

  /** 聚合各模块数据，供可视化中心使用 */
  async getSummary() {
    const todayStr = new Date().toISOString().slice(0, 10);

    // ===== 习惯 =====
    const habits = await this.db.select().from(lifeHabits).orderBy(desc(lifeHabits.createdAt));
    const habitRows = await this.db.select().from(lifeHabitRecords);

    const heatmapDays = 91;
    const heatmapMap = new Map<string, number>();
    for (const d of dateRange(heatmapDays)) heatmapMap.set(d, 0);
    for (const r of habitRows) {
      if (!r.completed) continue;
      heatmapMap.set(r.recordDate, (heatmapMap.get(r.recordDate) ?? 0) + 1);
    }
    const habitHeatmap = Array.from(heatmapMap.entries()).map(([date, count]) => ({ date, count }));

    const habitStats = habits.map((h) => ({
      id: h.id,
      name: h.name,
      icon: h.icon,
      color: h.color,
      frequency: h.frequency,
      streakCount: h.streakCount,
      totalCheckIns: habitRows.filter((r) => r.habitId === h.id && r.completed).length,
    }));

    const todayCheckIns = habitRows.filter((r) => r.completed && r.recordDate === todayStr).length;

    // ===== 番茄钟（插件数据：需开启「参与数据分析」才纳入统计）=====
    const pomoAnalysisEnabled = this.isAnalysisEnabled('dsh-plugin-pomodoro');
    const pomoRows = pomoAnalysisEnabled
      ? this.pomodoroStore.findAll().filter((r) => !r.abandoned)
      : [];
    const pomoDays = 30;
    const pomoMap = new Map<string, number>();
    for (const d of dateRange(pomoDays)) pomoMap.set(d, 0);
    for (const r of pomoRows) {
      const day = r.completedAt.slice(0, 10);
      if (pomoMap.has(day)) pomoMap.set(day, (pomoMap.get(day) ?? 0) + r.durationMinutes);
    }
    const pomodoroDaily = Array.from(pomoMap.entries()).map(([date, minutes]) => ({ date, minutes }));
    const pomodoroTotal = {
      count: pomoRows.length,
      minutes: pomoRows.reduce((s, r) => s + r.durationMinutes, 0),
    };
    const pomodoroToday = pomoRows
      .filter((r) => r.completedAt.startsWith(todayStr))
      .reduce((s, r) => s + r.durationMinutes, 0);

    // ===== 时间黑洞（插件数据：需开启「参与数据分析」才纳入统计）=====
    const blackholeAnalysisEnabled = this.isAnalysisEnabled('dsh-plugin-time-blackhole');
    const bhRows = blackholeAnalysisEnabled ? this.blackholeStore.findAll() : [];
    const bhDays = 30;
    const bhMap = new Map<string, number>();
    for (const d of dateRange(bhDays)) bhMap.set(d, 0);
    const bhCategoryMap = new Map<string, number>();
    for (const r of bhRows) {
      if (bhMap.has(r.recordDate)) {
        bhMap.set(r.recordDate, (bhMap.get(r.recordDate) ?? 0) + r.durationMinutes);
      }
      bhCategoryMap.set(r.category, (bhCategoryMap.get(r.category) ?? 0) + r.durationMinutes);
    }
    const blackholeDaily = Array.from(bhMap.entries()).map(([date, minutes]) => ({ date, minutes }));
    const blackholeByCategory = Array.from(bhCategoryMap.entries()).map(([category, minutes]) => ({
      category,
      minutes,
    }));
    const blackholeTotal = bhRows.reduce((s, r) => s + r.durationMinutes, 0);
    const blackholeToday = bhRows
      .filter((r) => r.recordDate === todayStr)
      .reduce((s, r) => s + r.durationMinutes, 0);

    // ===== 目标 =====
    const goals = await this.db.select().from(lifeGoals).orderBy(desc(lifeGoals.createdAt));
    const goalStats = goals.map((g) => ({
      id: g.id,
      title: g.title,
      category: g.category ?? '',
      status: g.status,
      progress: g.progress ?? 0,
    }));

    // ===== 插件数据（需在插件设置中开启「参与数据分析」） =====
    const pluginStats = await this.buildPluginStats();

    return {
      generatedAt: new Date().toISOString(),
      todayStr,
      habitHeatmap,
      habitStats,
      todayCheckIns,
      pomodoroDaily,
      pomodoroTotal,
      pomodoroToday,
      pomodoroAnalysisEnabled: pomoAnalysisEnabled,
      blackholeDaily,
      blackholeByCategory,
      blackholeTotal,
      blackholeToday,
      blackholeAnalysisEnabled,
      goalStats,
      pluginStats,
    };
  }
}

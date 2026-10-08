import { Inject, Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LOCAL_DATABASE } from '@server/storage/local-database.module';
import type { LocalDatabase } from '@server/storage/local-database';
import { JsonStore } from '@server/storage/json-store';
import { eq } from '@server/storage/drizzle-compat';
import {
  lifeGoals,
  lifeHabits,
  lifeHabitRecords,
  lifeEnergyRecords,
  lifeNotes,
  lifePrinciples,
  lifeQuickLinks,
  lifeLifeLogs,
  lifePluginConfig,
  lifeTasks,
  lifeFinanceAccounts,
  lifeFinanceTransactions,
  lifeFinanceBudgets,
  lifeHealthRecords,
  lifeChildResources,
} from '@server/database/schema';
import type {
  DataExportResult,
  DataImportResult,
  DataBackupV2,
  BackupImportPayload,
  ExportOptionItem,
  ExportOptionsResult,
  LifeGoal,
  LifeHabit,
  HabitRecord,
  EnergyRecord,
  LifeNote,
  LifePrinciple,
  QuickLink,
  PluginConfig,
  PluginCardConfig,
  Milestone,
} from '@shared/api.interface';

/** 核心模块定义（前端导出勾选项） */
const CORE_MODULES: { key: string; label: string; description: string; icon: string }[] = [
  { key: 'goals', label: '愿景目标', description: '目标、OKR 与里程碑', icon: 'target' },
  { key: 'habits', label: '微习惯', description: '习惯定义、今日打卡与精力记录', icon: 'clock' },
  { key: 'notes', label: '认知笔记', description: '闪念笔记、人生原则与快速链接', icon: 'brain' },
  { key: 'life-log', label: '人生日志', description: '全系统事件操作日志', icon: 'scroll-text' },
];

/** 插件数据读写器：key = pluginKey */
const PLUGIN_TABLE_KEYS: Record<string, string[]> = {
  'dsh-plugin-tasks-gtd': ['tasks'],
  'dsh-plugin-finance-ledger': ['accounts', 'transactions', 'budgets'],
  'dsh-plugin-health-fit': ['records'],
  'dsh-plugin-child-resources': ['resources'],
};

@Injectable()
export class DataManagerService {
  private readonly logger = new Logger(DataManagerService.name);
  private readonly EXPORT_VERSION_V2 = '2.0.0';

  constructor(
    @Inject(LOCAL_DATABASE) private readonly db: LocalDatabase,
  ) {}

  // ===== 导出选项 =====

  async getExportOptions(): Promise<ExportOptionsResult> {
    const modules: ExportOptionItem[] = [];
    for (const m of CORE_MODULES) {
      modules.push({
        key: m.key,
        label: m.label,
        description: m.description,
        icon: m.icon,
        count: await this.countModule(m.key),
      });
    }

    // 只展示已装载（enabled=true）且非核心看板的插件
    const pluginRows = await this.db
      .select()
      .from(lifePluginConfig)
      .where(eq(lifePluginConfig.enabled, true));
    const plugins: ExportOptionItem[] = [];
    for (const row of pluginRows) {
      if (row.pluginKey === 'dsh-plugin-life-dashboard') continue;
      const cfg = (row.config ?? {}) as Record<string, unknown>;
      plugins.push({
        key: row.pluginKey,
        label: row.name,
        description: row.description ?? '',
        icon: typeof cfg.cardIcon === 'string' ? cfg.cardIcon : 'sparkles',
        count: await this.countPluginData(row.pluginKey),
      });
    }

    return { modules, plugins, total: modules.length + plugins.length };
  }

  private async countModule(moduleKey: string): Promise<number> {
    switch (moduleKey) {
      case 'goals':
        return (await this.db.select().from(lifeGoals)).length;
      case 'habits': {
        const [a, b, c] = await Promise.all([
          this.db.select().from(lifeHabits),
          this.db.select().from(lifeHabitRecords),
          this.db.select().from(lifeEnergyRecords),
        ]);
        return a.length + b.length + c.length;
      }
      case 'notes': {
        const [a, b, c] = await Promise.all([
          this.db.select().from(lifeNotes),
          this.db.select().from(lifePrinciples),
          this.db.select().from(lifeQuickLinks),
        ]);
        return a.length + b.length + c.length;
      }
      case 'life-log':
        return (await this.db.select().from(lifeLifeLogs)).length;
      default:
        return 0;
    }
  }

  private async countPluginData(pluginKey: string): Promise<number> {
    const data = await this.readPluginData(pluginKey);
    return Object.values(data).reduce((acc, rows) => acc + rows.length, 0);
  }

  // ===== 按范围导出（v2） =====

  async exportByScopes(scopes: string[]): Promise<DataBackupV2> {
    const selected = new Set(scopes);
    const modules: DataBackupV2['modules'] = {};
    const pluginData: DataBackupV2['pluginData'] = {};

    if (selected.has('goals')) modules.goals = { goals: await this.db.select().from(lifeGoals) };
    if (selected.has('habits')) {
      const [habits, habitRecords, energyRecords] = await Promise.all([
        this.db.select().from(lifeHabits),
        this.db.select().from(lifeHabitRecords),
        this.db.select().from(lifeEnergyRecords),
      ]);
      modules.habits = { habits, habitRecords, energyRecords };
    }
    if (selected.has('notes')) {
      const [notes, principles, quickLinks] = await Promise.all([
        this.db.select().from(lifeNotes),
        this.db.select().from(lifePrinciples),
        this.db.select().from(lifeQuickLinks),
      ]);
      modules.notes = { notes, principles, quickLinks };
    }
    if (selected.has('life-log')) {
      modules['life-log'] = { logs: await this.db.select().from(lifeLifeLogs) };
    }

    for (const scope of selected) {
      if (scope.startsWith('plugin:')) {
        const pluginKey = scope.slice('plugin:'.length);
        const data = await this.readPluginData(pluginKey);
        if (Object.keys(data).length > 0) pluginData[pluginKey] = data;
      }
    }

    return {
      version: this.EXPORT_VERSION_V2 as '2.0.0',
      exportTime: new Date().toISOString(),
      modules,
      pluginData,
    };
  }

  private async readPluginData(pluginKey: string): Promise<Record<string, unknown[]>> {
    switch (pluginKey) {
      case 'dsh-plugin-pomodoro':
        return { records: new JsonStore<any>('pomodoro-records.json').findAll() };
      case 'dsh-plugin-time-blackhole':
        return { records: new JsonStore<any>('time-blackhole-records.json').findAll() };
      case 'dsh-plugin-tasks-gtd':
        return { tasks: await this.db.select().from(lifeTasks) };
      case 'dsh-plugin-finance-ledger': {
        const [accounts, transactions, budgets] = await Promise.all([
          this.db.select().from(lifeFinanceAccounts),
          this.db.select().from(lifeFinanceTransactions),
          this.db.select().from(lifeFinanceBudgets),
        ]);
        return { accounts, transactions, budgets };
      }
      case 'dsh-plugin-health-fit':
        return { records: await this.db.select().from(lifeHealthRecords) };
      case 'dsh-plugin-child-resources':
        return { resources: await this.db.select().from(lifeChildResources) };
      default:
        return {};
    }
  }

  /** 导入插件数据（清空该插件数据后写入） */
  private async writePluginData(
    pluginKey: string,
    data: Record<string, unknown[]>,
  ): Promise<number> {
    let count = 0;
    switch (pluginKey) {
      case 'dsh-plugin-pomodoro':
        new JsonStore<any>('pomodoro-records.json').replaceAll(
          (data.records ?? []) as { id: string }[],
        );
        count += (data.records ?? []).length;
        break;
      case 'dsh-plugin-time-blackhole':
        new JsonStore<any>('time-blackhole-records.json').replaceAll(
          (data.records ?? []) as { id: string }[],
        );
        count += (data.records ?? []).length;
        break;
      case 'dsh-plugin-tasks-gtd':
        await this.db.delete(lifeTasks);
        if (data.tasks && data.tasks.length > 0) {
          await this.db.insert(lifeTasks).values(data.tasks as never).onConflictDoNothing();
          count += data.tasks.length;
        }
        break;
      case 'dsh-plugin-finance-ledger':
        await this.db.delete(lifeFinanceAccounts);
        await this.db.delete(lifeFinanceTransactions);
        await this.db.delete(lifeFinanceBudgets);
        if (data.accounts && data.accounts.length > 0) {
          await this.db.insert(lifeFinanceAccounts).values(data.accounts as never).onConflictDoNothing();
          count += data.accounts.length;
        }
        if (data.transactions && data.transactions.length > 0) {
          await this.db.insert(lifeFinanceTransactions).values(data.transactions as never).onConflictDoNothing();
          count += data.transactions.length;
        }
        if (data.budgets && data.budgets.length > 0) {
          await this.db.insert(lifeFinanceBudgets).values(data.budgets as never).onConflictDoNothing();
          count += data.budgets.length;
        }
        break;
      case 'dsh-plugin-health-fit':
        await this.db.delete(lifeHealthRecords);
        if (data.records && data.records.length > 0) {
          await this.db.insert(lifeHealthRecords).values(data.records as never).onConflictDoNothing();
          count += data.records.length;
        }
        break;
      case 'dsh-plugin-child-resources':
        await this.db.delete(lifeChildResources);
        if (data.resources && data.resources.length > 0) {
          await this.db.insert(lifeChildResources).values(data.resources as never).onConflictDoNothing();
          count += data.resources.length;
        }
        break;
      default:
        break;
    }
    return count;
  }

  // ===== 全量导出（v1，兼容旧接口） =====

  async exportAllData(_userId: string): Promise<DataExportResult> {
    const [goalsRows, habitsRows, habitRecordsRows, energyRows, notesRows, principlesRows, quickLinksRows, pluginsRows] =
      await Promise.all([
        this.db.select().from(lifeGoals),
        this.db.select().from(lifeHabits),
        this.db.select().from(lifeHabitRecords),
        this.db.select().from(lifeEnergyRecords),
        this.db.select().from(lifeNotes),
        this.db.select().from(lifePrinciples),
        this.db.select().from(lifeQuickLinks),
        this.db.select().from(lifePluginConfig),
      ]);

    const goals: LifeGoal[] = goalsRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      progress: row.progress,
      category: row.category,
      deadline: row.deadline,
      milestones: (row.milestones as Milestone[]) ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    const habits: LifeHabit[] = habitsRows.map((row) => ({
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      frequency: row.frequency,
      streakCount: row.streakCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    const habitRecords: HabitRecord[] = habitRecordsRows.map((row) => ({
      id: row.id,
      habitId: row.habitId,
      recordDate: row.recordDate,
      completed: row.completed,
    }));

    const energyRecords: EnergyRecord[] = energyRows.map((row) => ({
      id: row.id,
      recordDate: row.recordDate,
      energyLevel: row.energyLevel,
      focusLevel: row.focusLevel,
      mood: row.mood,
      note: row.note,
    }));

    const notes: LifeNote[] = notesRows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      tags: row.tags ?? [],
      isPinned: row.isPinned,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    const principles: LifePrinciple[] = principlesRows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    const quickLinks: QuickLink[] = quickLinksRows.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      icon: row.icon,
      category: row.category,
      sortOrder: row.sortOrder,
    }));

    const plugins: PluginConfig[] = pluginsRows.map((row) => ({
      id: row.id,
      pluginKey: row.pluginKey,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      version: row.version,
      lifecycleStatus: row.lifecycleStatus as PluginConfig['lifecycleStatus'],
      riskLevel: (row.riskLevel as PluginConfig['riskLevel']) ?? 'low',
      capabilities: (row.capabilities as string[]) ?? [],
      config: (row.config as PluginCardConfig) ?? {
        cardTitle: '',
        cardDescription: '',
        cardIcon: '',
        routePath: '',
        gradientFrom: '',
        gradientTo: '',
      },
    }));

    return {
      goals,
      habits,
      habitRecords,
      energyRecords,
      notes,
      principles,
      quickLinks,
      plugins,
      exportTime: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  async generateBackupFile(userId: string): Promise<{ data: string; filename: string }> {
    const exportData = await this.exportAllData(userId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `life-os-backup-${timestamp}.json`;

    return {
      data: JSON.stringify(exportData, null, 2),
      filename,
    };
  }

  async generateBackupFileByScopes(
    scopes: string[],
  ): Promise<{ data: string; filename: string }> {
    const exportData = await this.exportByScopes(scopes);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `life-os-backup-${timestamp}.json`;

    return {
      data: JSON.stringify(exportData, null, 2),
      filename,
    };
  }

  // ===== 导入（自动区分 v2 模块/插件 与 v1 平铺格式） =====

  async importData(userId: string, data: BackupImportPayload): Promise<DataImportResult> {
    const v2 = data as DataBackupV2;
    if (v2.version === '2.0.0') {
      return this.importV2(userId, v2);
    }
    return this.importV1(userId, data as DataExportResult);
  }

  private async importV1(userId: string, data: DataExportResult): Promise<DataImportResult> {
    this.logger.log(`Starting v1 data import for user ${userId}`);

    const result = await this.db.transaction(async (tx) => {
      await tx.delete(lifeHabitRecords);
      await tx.delete(lifeEnergyRecords);
      await tx.delete(lifeHabits);
      await tx.delete(lifeGoals);
      await tx.delete(lifeNotes);
      await tx.delete(lifePrinciples);
      await tx.delete(lifeQuickLinks);

      let goalsCount = 0;
      let habitsCount = 0;
      let habitRecordsCount = 0;
      let energyRecordsCount = 0;
      let notesCount = 0;
      let principlesCount = 0;
      let quickLinksCount = 0;
      let pluginsCount = 0;

      if (data.goals && data.goals.length > 0) {
        const values = data.goals.map((goal: LifeGoal) => ({
          id: goal.id,
          title: goal.title,
          description: goal.description,
          status: goal.status,
          progress: goal.progress,
          category: goal.category,
          deadline: goal.deadline,
          milestones: goal.milestones as unknown as typeof lifeGoals.$inferInsert.milestones,
        }));
        await tx.insert(lifeGoals).values(values).onConflictDoNothing();
        goalsCount = values.length;
      }

      if (data.habits && data.habits.length > 0) {
        const values = data.habits.map((habit: LifeHabit) => ({
          id: habit.id,
          name: habit.name,
          icon: habit.icon,
          color: habit.color,
          frequency: habit.frequency,
          streakCount: habit.streakCount,
        }));
        await tx.insert(lifeHabits).values(values).onConflictDoNothing();
        habitsCount = values.length;
      }

      if (data.habitRecords && data.habitRecords.length > 0) {
        const values = data.habitRecords.map((rec: HabitRecord) => ({
          id: rec.id,
          habitId: rec.habitId,
          recordDate: rec.recordDate,
          completed: rec.completed,
        }));
        await tx.insert(lifeHabitRecords).values(values).onConflictDoNothing();
        habitRecordsCount = values.length;
      }

      if (data.energyRecords && data.energyRecords.length > 0) {
        const values = data.energyRecords.map((rec: EnergyRecord) => ({
          id: rec.id,
          recordDate: rec.recordDate,
          energyLevel: rec.energyLevel,
          focusLevel: rec.focusLevel,
          mood: rec.mood,
          note: rec.note,
        }));
        await tx.insert(lifeEnergyRecords).values(values).onConflictDoNothing();
        energyRecordsCount = values.length;
      }

      if (data.notes && data.notes.length > 0) {
        const values = data.notes.map((note: LifeNote) => ({
          id: note.id,
          title: note.title,
          content: note.content,
          tags: note.tags,
          isPinned: note.isPinned,
        }));
        await tx.insert(lifeNotes).values(values).onConflictDoNothing();
        notesCount = values.length;
      }

      if (data.principles && data.principles.length > 0) {
        const values = data.principles.map((p: LifePrinciple) => ({
          id: p.id,
          title: p.title,
          content: p.content,
          category: p.category,
        }));
        await tx.insert(lifePrinciples).values(values).onConflictDoNothing();
        principlesCount = values.length;
      }

      if (data.quickLinks && data.quickLinks.length > 0) {
        const values = data.quickLinks.map((ql: QuickLink) => ({
          id: ql.id,
          title: ql.title,
          url: ql.url,
          icon: ql.icon,
          category: ql.category,
          sortOrder: ql.sortOrder,
        }));
        await tx.insert(lifeQuickLinks).values(values).onConflictDoNothing();
        quickLinksCount = values.length;
      }

      if (data.plugins && data.plugins.length > 0) {
        const values = data.plugins.map((p: PluginConfig) => ({
          id: p.id,
          pluginKey: p.pluginKey,
          name: p.name,
          description: p.description,
          enabled: p.enabled,
          version: p.version,
          config: p.config as unknown as typeof lifePluginConfig.$inferInsert.config,
        }));
        await tx.insert(lifePluginConfig).values(values).onConflictDoNothing();
        pluginsCount = values.length;
      }

      return {
        goals: goalsCount,
        habits: habitsCount,
        habitRecords: habitRecordsCount,
        energyRecords: energyRecordsCount,
        notes: notesCount,
        principles: principlesCount,
        quickLinks: quickLinksCount,
        plugins: pluginsCount,
        modules: {},
        pluginData: {},
      };
    });

    return { success: true, imported: result };
  }

  private async importV2(userId: string, data: DataBackupV2): Promise<DataImportResult> {
    this.logger.log(`Starting v2 data import for user ${userId}`);

    const imported = await this.db.transaction(async (tx) => {
      const modules: Record<string, number> = {};
      const pluginData: Record<string, number> = {};

      // ===== 核心模块导入（按模块清空 + 写入） =====
      if (data.modules?.goals) {
        await tx.delete(lifeGoals);
        const rows = data.modules.goals.goals ?? [];
        if (rows.length > 0) {
          await tx.insert(lifeGoals).values(rows as never).onConflictDoNothing();
        }
        modules.goals = rows.length;
      }

      if (data.modules?.habits) {
        await tx.delete(lifeHabitRecords);
        await tx.delete(lifeEnergyRecords);
        await tx.delete(lifeHabits);
        const habits = data.modules.habits.habits ?? [];
        const records = data.modules.habits.habitRecords ?? [];
        const energy = data.modules.habits.energyRecords ?? [];
        if (habits.length > 0) await tx.insert(lifeHabits).values(habits as never).onConflictDoNothing();
        if (records.length > 0) await tx.insert(lifeHabitRecords).values(records as never).onConflictDoNothing();
        if (energy.length > 0) await tx.insert(lifeEnergyRecords).values(energy as never).onConflictDoNothing();
        modules.habits = habits.length + records.length + energy.length;
      }

      if (data.modules?.notes) {
        await tx.delete(lifeNotes);
        await tx.delete(lifePrinciples);
        await tx.delete(lifeQuickLinks);
        const notes = data.modules.notes.notes ?? [];
        const principles = data.modules.notes.principles ?? [];
        const quickLinks = data.modules.notes.quickLinks ?? [];
        if (notes.length > 0) await tx.insert(lifeNotes).values(notes as never).onConflictDoNothing();
        if (principles.length > 0) await tx.insert(lifePrinciples).values(principles as never).onConflictDoNothing();
        if (quickLinks.length > 0) await tx.insert(lifeQuickLinks).values(quickLinks as never).onConflictDoNothing();
        modules.notes = notes.length + principles.length + quickLinks.length;
      }

      if (data.modules?.['life-log']) {
        await tx.delete(lifeLifeLogs);
        const rows = data.modules['life-log'].logs ?? [];
        if (rows.length > 0) await tx.insert(lifeLifeLogs).values(rows as never).onConflictDoNothing();
        modules['life-log'] = rows.length;
      }

      // ===== 插件数据导入（区分插件，各自覆盖） =====
      for (const [pluginKey, dataMap] of Object.entries(data.pluginData ?? {})) {
        pluginData[pluginKey] = await this.writePluginData(pluginKey, dataMap);
      }

      return { modules, pluginData };
    });

    return {
      success: true,
      imported: {
        goals: imported.modules.goals ?? 0,
        habits: imported.modules.habits ?? 0,
        habitRecords: 0,
        energyRecords: 0,
        notes: imported.modules.notes ?? 0,
        principles: 0,
        quickLinks: 0,
        plugins: 0,
        modules: imported.modules,
        pluginData: imported.pluginData,
      },
    };
  }
}

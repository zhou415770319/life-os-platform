import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { LOCAL_DATABASE } from '@server/storage/local-database.module';
import type { LocalDatabase } from '@server/storage/local-database';
import { eq, ne, like, ilike, and, or, desc, asc, count, gte, lte, gt, lt, sql } from '@server/storage/drizzle-compat';
import { lifePluginConfig } from '@server/database/schema';
import type {
  PluginConfig,
  UpdatePluginDto,
  PluginCardConfig,
  AvailablePlugin,
  InstalledPlugin,
  PluginLifecycleStatus,
} from '@shared/api.interface';
import { LifeLogService } from '@server/modules/life-log/life-log.service';

const CORE_PLUGIN_KEY = 'dsh-plugin-life-dashboard';

interface SeedPluginDef {
  pluginKey: string;
  name: string;
  description: string;
  version: string;
  category: string;
  enabled: boolean;
  lifecycleStatus: PluginLifecycleStatus;
  riskLevel: 'low' | 'medium' | 'high';
  capabilities: string[];
  config: PluginCardConfig & { category: string };
  /** 该插件是否有可聚合进数据分析的数据 */
  analyzable?: boolean;
  /** 分析维度简短描述 */
  analysisLabel?: string;
}

const SEED_PLUGINS: SeedPluginDef[] = [
  {
    pluginKey: 'dsh-plugin-life-dashboard',
    name: '人生管理看板',
    description: '系统核心插件，提供人生管理基础看板（目标、习惯、认知三大核心模块）',
    version: '1.0.0',
    category: 'core',
    enabled: true,
    lifecycleStatus: 'active',
    riskLevel: 'low',
    capabilities: ['dashboard', 'goals', 'habits', 'notes'],
    config: {
      category: 'core',
      cardTitle: '人生看板',
      cardDescription: '目标追踪 · 习惯打卡 · 认知笔记',
      cardIcon: 'dashboard',
      routePath: '/',
      gradientFrom: '#6366f1',
      gradientTo: '#8b5cf6',
    },
  },
  {
    pluginKey: 'dsh-plugin-child-resources',
    name: '儿童资料站',
    description: '儿童自学与启蒙资料库，提供 RAZ 分级阅读、廖彩杏绘本、牛津树、海尼曼等资源导航',
    version: '1.0.0',
    category: 'education',
    enabled: false,
    lifecycleStatus: 'discovered',
    riskLevel: 'low',
    capabilities: ['resource-navigation', 'child-education'],
    analyzable: true,
    analysisLabel: '资料数量',
    config: {
      category: 'education',
      cardTitle: '儿童资料站',
      cardDescription: 'RAZ分级阅读 · 廖彩杏 · 牛津树',
      cardIcon: 'baby',
      routePath: '/child-resources',
      gradientFrom: '#22d3ee',
      gradientTo: '#3b82f6',
    },
  },
  {
    pluginKey: 'dsh-plugin-wechat-rpa',
    name: 'RPA 智能创作中心',
    description: '智能创作中心，影刀 RPA 联动 Kimi 自动生成公众号草稿，支持一键发布到微信公众号',
    version: '1.0.0',
    category: 'productivity',
    enabled: false,
    lifecycleStatus: 'discovered',
    riskLevel: 'medium',
    capabilities: ['content-generation', 'rpa-integration'],
    config: {
      category: 'productivity',
      cardTitle: 'RPA 智能创作',
      cardDescription: '影刀RPA · Kimi · 公众号自动化',
      cardIcon: 'bot',
      routePath: '/rpa-center',
      gradientFrom: '#f59e0b',
      gradientTo: '#ef4444',
    },
  },
  {
    pluginKey: 'dsh-plugin-tasks-gtd',
    name: '任务管理 GTD',
    description: '基于 GTD 理念的任务管理系统，支持收集箱、四象限矩阵、项目分解、子任务、上下文标签',
    version: '1.0.0',
    category: 'productivity',
    enabled: false,
    lifecycleStatus: 'discovered',
    riskLevel: 'low',
    capabilities: ['task-management', 'gtd', 'quadrant-matrix', 'project-management'],
    config: {
      category: 'productivity',
      cardTitle: '任务管理',
      cardDescription: 'GTD方法 · 四象限 · 项目分解',
      cardIcon: 'check-square',
      routePath: '/tasks',
      gradientFrom: '#8b5cf6',
      gradientTo: '#6366f1',
    },
  },
  {
    pluginKey: 'dsh-plugin-finance-ledger',
    name: '财务记账本',
    description: '个人财务管理插件，支持收支流水、多账户管理、分类统计、预算设置与超支预警',
    version: '1.0.0',
    category: 'finance',
    enabled: false,
    lifecycleStatus: 'discovered',
    riskLevel: 'low',
    capabilities: ['finance-tracking', 'budget-management', 'multi-account', 'analytics'],
    config: {
      category: 'finance',
      cardTitle: '财务记账',
      cardDescription: '收支流水 · 多账户 · 预算管理',
      cardIcon: 'wallet',
      routePath: '/finance',
      gradientFrom: '#10b981',
      gradientTo: '#14b8a6',
    },
  },
  {
    pluginKey: 'dsh-plugin-health-fit',
    name: '健康管理中心',
    description: '个人健康数据追踪，支持身体指标记录、运动日志、睡眠追踪与健康趋势分析',
    version: '1.0.0',
    category: 'health',
    enabled: false,
    lifecycleStatus: 'discovered',
    riskLevel: 'low',
    capabilities: ['health-tracking', 'exercise-log', 'sleep-tracking', 'trend-analysis'],
    config: {
      category: 'health',
      cardTitle: '健康管理',
      cardDescription: '身体数据 · 运动日志 · 睡眠追踪',
      cardIcon: 'heart-pulse',
      routePath: '/health',
      gradientFrom: '#f43f5e',
      gradientTo: '#f97316',
    },
  },
  {
    pluginKey: 'dsh-plugin-reading-lab',
    name: '阅读实验室',
    description: '个人阅读管理插件，支持书籍管理、阅读进度追踪、读书笔记、书单推荐等',
    version: '0.8.0',
    category: 'lifestyle',
    enabled: false,
    lifecycleStatus: 'discovered',
    riskLevel: 'low',
    capabilities: ['reading-tracking', 'book-management'],
    config: {
      category: 'lifestyle',
      cardTitle: '阅读实验室',
      cardDescription: '书籍管理 · 阅读进度 · 读书笔记',
      cardIcon: 'book',
      routePath: '/reading',
      gradientFrom: '#a855f7',
      gradientTo: '#ec4899',
    },
  },
  {
    pluginKey: 'dsh-plugin-pomodoro',
    name: '番茄钟记录',
    description: '番茄工作法专注计时，支持 15/25/45/60 分钟专注，自动保存专注记录并统计每日/累计专注时长',
    version: '1.0.0',
    category: 'productivity',
    enabled: true,
    lifecycleStatus: 'active',
    riskLevel: 'low',
    capabilities: ['focus-timer', 'time-management', 'productivity'],
    analyzable: true,
    analysisLabel: '专注时长/次数',
    config: {
      category: 'productivity',
      cardTitle: '番茄钟记录',
      cardDescription: '专注计时 · 专注统计',
      cardIcon: 'timer',
      routePath: '/pomodoro',
      gradientFrom: '#ef4444',
      gradientTo: '#f97316',
    },
  },
  {
    pluginKey: 'dsh-plugin-time-blackhole',
    name: '时间黑洞',
    description: '诚实记录被浪费的时间：发呆、刷短视频、八卦闲聊等，分类统计每日流失时间，帮助找回时间',
    version: '1.0.0',
    category: 'productivity',
    enabled: true,
    lifecycleStatus: 'active',
    riskLevel: 'low',
    capabilities: ['time-audit', 'focus-tracking', 'productivity'],
    analyzable: true,
    analysisLabel: '浪费时间分钟数',
    config: {
      category: 'productivity',
      cardTitle: '时间黑洞',
      cardDescription: '浪费时间记录 · 分类统计',
      cardIcon: 'hourglass',
      routePath: '/time-blackhole',
      gradientFrom: '#0f172a',
      gradientTo: '#64748b',
    },
  },
  {
    pluginKey: 'dsh-plugin-rpa-manager',
    name: 'RPA 管理',
    description: '本地文件与 Excel 管理：选择本地文件夹或文件，读取 Excel 表格内容，在线编辑修改并导出保存',
    version: '1.0.0',
    category: 'productivity',
    enabled: true,
    lifecycleStatus: 'active',
    riskLevel: 'medium',
    capabilities: ['file-management', 'excel-editing', 'rpa'],
    analyzable: true,
    analysisLabel: '管理文件数',
    config: {
      category: 'productivity',
      cardTitle: 'RPA 管理',
      cardDescription: '本地文件 · Excel 读写编辑',
      cardIcon: 'file-spreadsheet',
      routePath: '/rpa-manager',
      gradientFrom: '#f59e0b',
      gradientTo: '#ef4444',
    },
  },
  {
    pluginKey: 'dsh-plugin-review-board',
    name: '复盘面板',
    description: '三级复盘面板：Markdown 编辑 + 任务勾选，每日按日期归档到周、每周日归档到月，支持发布分享链接与 ShareOne 公网发布',
    version: '1.0.0',
    category: 'productivity',
    enabled: false,
    lifecycleStatus: 'discovered',
    riskLevel: 'low',
    capabilities: ['markdown-editor', 'review', 'archive', 'share', 'publish'],
    config: {
      category: 'productivity',
      cardTitle: '复盘面板',
      cardDescription: '每日/每周/每月 · Markdown 复盘',
      cardIcon: 'clipboard-list',
      routePath: '/review-board',
      gradientFrom: '#22c55e',
      gradientTo: '#10b981',
    },
  },
  {
    pluginKey: 'dsh-plugin-child-tv',
    name: '儿童定时播放',
    description: '儿童定时播放・家长远程控制：mpv 定时全屏播放本地/网络音视频，家长可远程播放、停止、锁定电脑，儿童观看页无操作按钮',
    version: '1.0.0',
    category: 'education',
    enabled: false,
    lifecycleStatus: 'discovered',
    riskLevel: 'medium',
    capabilities: ['child-education', 'media-player', 'scheduler', 'remote-control', 'parental-control'],
    analyzable: true,
    analysisLabel: '播放次数',
    config: {
      category: 'education',
      cardTitle: '儿童定时播放',
      cardDescription: '定时播放 · 家长远程 · 锁定电脑',
      cardIcon: 'tv',
      routePath: '/child-tv-admin',
      gradientFrom: '#f43f5e',
      gradientTo: '#8b5cf6',
    },
  },
];

@Injectable()
export class PluginsService implements OnModuleInit {
  private readonly logger = new Logger(PluginsService.name);

  constructor(
    @Inject(LOCAL_DATABASE) private readonly db: LocalDatabase,
    private readonly lifeLogService: LifeLogService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      for (const plugin of SEED_PLUGINS) {
        await this.db
          .insert(lifePluginConfig)
          .values({
            pluginKey: plugin.pluginKey,
            name: plugin.name,
            description: plugin.description,
            enabled: plugin.enabled,
            version: plugin.version,
            config: plugin.config as unknown as Record<string, unknown>,
            lifecycleStatus: plugin.lifecycleStatus,
            riskLevel: plugin.riskLevel,
            capabilities: plugin.capabilities as unknown as string[],
          })
          .onConflictDoUpdate({
            target: lifePluginConfig.pluginKey,
            set: {
              description: plugin.description,
              version: plugin.version,
              config: plugin.config as unknown as Record<string, unknown>,
              riskLevel: plugin.riskLevel,
              capabilities: plugin.capabilities as unknown as string[],
            },
          });
      }
      this.logger.log(`Plugin seed complete, ${SEED_PLUGINS.length} plugins checked`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to seed plugins: ${message}`, stack);
    }
  }

  async findAll(): Promise<{ items: PluginConfig[]; total: number }> {
    const rows = await this.db.select().from(lifePluginConfig);
    const items: PluginConfig[] = rows.map((row) => this.mapRowToPlugin(row));
    return { items, total: items.length };
  }

  async getAvailablePlugins(): Promise<{ items: AvailablePlugin[]; total: number }> {
    const rows = await this.db.select().from(lifePluginConfig);
    const items: AvailablePlugin[] = rows.map((row) => {
      const cfg = (row.config ?? {}) as Record<string, unknown>;
      const category = typeof cfg.category === 'string' ? cfg.category : 'other';
      const seed = SEED_PLUGINS.find((s) => s.pluginKey === row.pluginKey);
      return {
        pluginKey: row.pluginKey,
        name: row.name,
        description: row.description ?? '',
        version: row.version ?? '',
        category,
        isCore: row.pluginKey === CORE_PLUGIN_KEY,
        config: this.stripCategoryFromConfig(cfg),
        installed: row.enabled,
        lifecycleStatus: row.lifecycleStatus as PluginLifecycleStatus,
        riskLevel: row.riskLevel as 'low' | 'medium' | 'high',
        analyzable: seed?.analyzable ?? false,
        analysisLabel: seed?.analysisLabel,
      };
    });
    return { items, total: items.length };
  }

  async getInstalledPlugins(): Promise<{ items: InstalledPlugin[]; total: number }> {
    const rows = await this.db
      .select()
      .from(lifePluginConfig)
      .where(eq(lifePluginConfig.enabled, true));
    const items: InstalledPlugin[] = rows.map((row) => ({
      ...this.mapRowToPlugin(row),
      installedAt: row.createdAt.toISOString(),
      isCore: row.pluginKey === CORE_PLUGIN_KEY,
    }));
    return { items, total: items.length };
  }

  async installPlugin(pluginKey: string): Promise<PluginConfig> {
    try {
      const result = await this.db.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(lifePluginConfig)
          .where(eq(lifePluginConfig.pluginKey, pluginKey));

        if (existing.length === 0) {
          throw new NotFoundException('插件不存在或不在可用列表中');
        }

        if (existing[0].enabled) {
          throw new ConflictException('插件已安装且处于启用状态');
        }

        const [row] = await tx
          .update(lifePluginConfig)
          .set({
            enabled: true,
            lifecycleStatus: 'loading',
          })
          .where(eq(lifePluginConfig.pluginKey, pluginKey))
          .returning();

        if (!row) {
          throw new NotFoundException('插件不存在');
        }

        return row;
      });

      setTimeout(() => {
        this.db
          .update(lifePluginConfig)
          .set({ lifecycleStatus: 'active' })
          .where(eq(lifePluginConfig.pluginKey, pluginKey))
          .catch((err) => {
            this.logger.error(`Failed to activate plugin ${pluginKey}: ${String(err)}`);
          });
      }, 300);

      this.logger.log(`Plugin installed: ${pluginKey}`);
      void this.lifeLogService.append({
        eventType: 'plugin_installed',
        eventCategory: 'plugins',
        contentSummary: `安装插件：${result.name}`,
        metadata: { pluginKey },
      });

      return this.mapRowToPlugin(result);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to install plugin ${pluginKey}: ${message}`, stack);
      throw error;
    }
  }

  async uninstallPlugin(pluginKey: string): Promise<{ success: boolean }> {
    try {
      if (pluginKey === CORE_PLUGIN_KEY) {
        throw new BadRequestException('核心插件不可卸载');
      }

      let pluginName = '';
      await this.db.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(lifePluginConfig)
          .where(eq(lifePluginConfig.pluginKey, pluginKey));

        if (existing.length === 0) {
          throw new NotFoundException('插件未安装');
        }

        pluginName = existing[0].name;

        const updated = await tx
          .update(lifePluginConfig)
          .set({
            enabled: false,
            lifecycleStatus: 'unloaded',
          })
          .where(eq(lifePluginConfig.pluginKey, pluginKey))
          .returning({ id: lifePluginConfig.id });

        if (updated.length === 0) {
          throw new NotFoundException('插件不存在');
        }
      });

      this.logger.log(`Plugin uninstalled: ${pluginKey}`);
      void this.lifeLogService.append({
        eventType: 'plugin_uninstalled',
        eventCategory: 'plugins',
        contentSummary: `卸载插件：${pluginName}`,
        metadata: { pluginKey },
      });

      return { success: true };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to uninstall plugin ${pluginKey}: ${message}`, stack);
      throw error;
    }
  }

  async suspendPlugin(pluginKey: string): Promise<PluginConfig> {
    const existing = await this.db
      .select()
      .from(lifePluginConfig)
      .where(eq(lifePluginConfig.pluginKey, pluginKey));

    if (existing.length === 0) {
      throw new NotFoundException('插件不存在');
    }
    if (existing[0].lifecycleStatus !== 'active') {
      throw new BadRequestException('只有处于运行中的插件才能暂停');
    }
    if (pluginKey === CORE_PLUGIN_KEY) {
      throw new BadRequestException('核心插件不可暂停');
    }

    const [row] = await this.db
      .update(lifePluginConfig)
      .set({ lifecycleStatus: 'suspended' })
      .where(eq(lifePluginConfig.pluginKey, pluginKey))
      .returning();

    if (!row) {
      throw new NotFoundException('插件不存在');
    }

    this.logger.log(`Plugin suspended: ${pluginKey}`);
    void this.lifeLogService.append({
      eventType: 'plugin_suspended',
      eventCategory: 'plugins',
      contentSummary: `暂停插件：${row.name}`,
      metadata: { pluginKey },
    });

    return this.mapRowToPlugin(row);
  }

  async resumePlugin(pluginKey: string): Promise<PluginConfig> {
    const existing = await this.db
      .select()
      .from(lifePluginConfig)
      .where(eq(lifePluginConfig.pluginKey, pluginKey));

    if (existing.length === 0) {
      throw new NotFoundException('插件不存在');
    }
    if (existing[0].lifecycleStatus !== 'suspended') {
      throw new BadRequestException('只有处于暂停状态的插件才能恢复');
    }

    const [row] = await this.db
      .update(lifePluginConfig)
      .set({ lifecycleStatus: 'active' })
      .where(eq(lifePluginConfig.pluginKey, pluginKey))
      .returning();

    if (!row) {
      throw new NotFoundException('插件不存在');
    }

    this.logger.log(`Plugin resumed: ${pluginKey}`);
    void this.lifeLogService.append({
      eventType: 'plugin_resumed',
      eventCategory: 'plugins',
      contentSummary: `恢复插件：${row.name}`,
      metadata: { pluginKey },
    });

    return this.mapRowToPlugin(row);
  }

  async update(id: string, dto: UpdatePluginDto): Promise<PluginConfig> {
    const [existingRow] = await this.db
      .select()
      .from(lifePluginConfig)
      .where(eq(lifePluginConfig.id, id));
    if (!existingRow) {
      throw new NotFoundException('插件不存在');
    }

    const patch: Partial<typeof lifePluginConfig.$inferInsert> = {};
    if (dto.enabled !== undefined) patch.enabled = dto.enabled;
    if (dto.config !== undefined) {
      // 深合并，避免覆盖 category 等已有配置
      patch.config = {
        ...(existingRow.config ?? {}),
        ...dto.config,
      } as unknown as Record<string, unknown>;
    }
    if (dto.lifecycleStatus !== undefined) patch.lifecycleStatus = dto.lifecycleStatus;
    if (dto.riskLevel !== undefined) patch.riskLevel = dto.riskLevel;
    if (dto.capabilities !== undefined) patch.capabilities = dto.capabilities as unknown as string[];

    if (Object.keys(patch).length === 0) {
      return this.mapRowToPlugin(existingRow);
    }

    const [row] = await this.db
      .update(lifePluginConfig)
      .set(patch)
      .where(eq(lifePluginConfig.id, id))
      .returning();

    if (!row) {
      throw new NotFoundException('插件不存在');
    }

    return this.mapRowToPlugin(row);
  }

  async getDshProfile(): Promise<{
    platformName: string;
    version: string;
    theme: string;
    plugins: PluginConfig[];
  }> {
    const { items } = await this.findAll();
    return {
      platformName: 'Life-OS',
      version: '1.0.0',
      theme: 'dark-minimal',
      plugins: items,
    };
  }

  private mapRowToPlugin(row: typeof lifePluginConfig.$inferSelect): PluginConfig {
    const cfg = (row.config ?? {}) as Record<string, unknown>;
    const caps = Array.isArray(row.capabilities) ? (row.capabilities as string[]) : [];
    const seed = SEED_PLUGINS.find((s) => s.pluginKey === row.pluginKey);
    return {
      id: row.id,
      pluginKey: row.pluginKey,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      version: row.version,
      config: this.stripCategoryFromConfig(cfg),
      lifecycleStatus: (row.lifecycleStatus ?? 'discovered') as PluginLifecycleStatus,
      riskLevel: (row.riskLevel ?? 'low') as 'low' | 'medium' | 'high',
      capabilities: caps,
      analyzable: seed?.analyzable ?? false,
      analysisLabel: seed?.analysisLabel,
    };
  }

  private stripCategoryFromConfig(cfg: Record<string, unknown>): PluginCardConfig {
    const { category: _category, ...rest } = cfg;
    return rest as unknown as PluginCardConfig;
  }
}


import {
  Inject,
  Injectable,
  Logger,
  Optional,
  NotFoundException,
  BadRequestException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { LOCAL_DATABASE } from '@server/storage/local-database.module';
import type { LocalDatabase } from '@server/storage/local-database';
import { eq, ne, like, ilike, and, or, desc, asc, count, gte, lte, gt, lt, sql } from '@server/storage/drizzle-compat';
import { lifePluginConfig, lifePluginInstallations } from '@server/database/schema';
import type {
  PluginConfig,
  UpdatePluginDto,
  PluginCardConfig,
  AvailablePlugin,
  InstalledPlugin,
  PluginLifecycleStatus,
} from '@shared/api.interface';
import { LifeLogService } from '@server/modules/life-log/life-log.service';
import { PluginRuntimeService } from './plugin-runtime.service';
import { ChildTvService } from '@server/modules/child-tv/child-tv.service';
import { LocalUserStore } from '@server/modules/auth/local-user.store';

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
    enabled: true,
    lifecycleStatus: 'active',
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
    enabled: true,
    lifecycleStatus: 'active',
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
    enabled: true,
    lifecycleStatus: 'active',
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
    enabled: true,
    lifecycleStatus: 'active',
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
    enabled: true,
    lifecycleStatus: 'active',
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
    enabled: false,
    lifecycleStatus: 'discovered',
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
    enabled: true,
    lifecycleStatus: 'active',
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
    description: '儿童定时播放・单机模式：mpv 定时全屏置顶播放本地/网络音视频，家长可远程播放/停止、管理时段与内容来源，儿童观看页纯展示',
    version: '1.2.0',
    category: 'education',
    enabled: true,
    lifecycleStatus: 'active',
    riskLevel: 'medium',
    capabilities: ['child-education', 'media-player', 'scheduler', 'remote-control'],
    analyzable: true,
    analysisLabel: '播放次数',
    config: {
      category: 'education',
      cardTitle: '儿童定时播放',
      cardDescription: '定时播放 · 家长远程控制',
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
    private readonly pluginRuntime: PluginRuntimeService,
    private readonly userStore: LocalUserStore,
    @Optional() private readonly childTvService?: ChildTvService,
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
            // 目录表不再承载「启用状态」：enabled/lifecycleStatus 由每个用户的装载表决定
            enabled: false,
            version: plugin.version,
            config: plugin.config as unknown as Record<string, unknown>,
            lifecycleStatus: 'discovered',
            riskLevel: plugin.riskLevel,
            capabilities: plugin.capabilities as unknown as string[],
          })
          .onConflictDoUpdate({
            target: lifePluginConfig.pluginKey,
            set: {
              // 注意：不覆盖 version / description —— 这两个字段由「提交到插件市场」
              // 写回（submitPlugin 会同步本地 manifest 与插件记录），或由用户手动维护；
              // 若每次启动都用 SEED 覆盖，会导致本地/线上版本被旧种子值回退而不一致。
              config: plugin.config as unknown as Record<string, unknown>,
              riskLevel: plugin.riskLevel,
              capabilities: plugin.capabilities as unknown as string[],
            },
          });
        // 统一插件结构：为内置插件生成标准插件包（manifest.json + plugin.js + README.md）
        // 与线上市场安装的插件（user-data/plugins/<key>/）保持同一目录结构，
        // 使内置插件同样支持「提交到插件市场」。
        this.ensureSeedPluginPackage(plugin);
      }
      this.logger.log(`Plugin seed complete, ${SEED_PLUGINS.length} plugins checked`);

      // 存量迁移：旧版全局 enabled 状态 → 管理员用户的装载表（仅首次、装载表为空时执行）
      await this.migrateLegacyInstallations();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to seed plugins: ${message}`, stack);
    }
  }

  /**
   * 存量迁移：life-plugin-config 升级为「目录 + 按用户装载」前，enabled/lifecycleStatus
   * 是全局单行状态。首次启动时把目录表中 enabled=true 的插件装载到管理员账号下，
   * 保证老用户（admin）现有装载不丢失；装载表非空则跳过（幂等）。
   */
  private async migrateLegacyInstallations(): Promise<void> {
    try {
      const existing = await this.db.select().from(lifePluginInstallations);
      if (existing.length > 0) return; // 已迁移过

      const allUsers = this.userStore.findAll();
      const admin = allUsers.find((u) => u.role === 'admin') ?? allUsers[0];
      if (!admin) return;

      const dirRows = await this.db
        .select()
        .from(lifePluginConfig)
        .where(eq(lifePluginConfig.enabled, true));
      if (dirRows.length === 0) return;

      for (const row of dirRows) {
        await this.db
          .insert(lifePluginInstallations)
          .values({
            userId: admin.id,
            pluginKey: row.pluginKey,
            enabled: true,
            lifecycleStatus: (row.lifecycleStatus ?? 'active') as PluginLifecycleStatus,
            installedAt: row.createdAt ?? new Date(),
          })
          .onConflictDoNothing();
      }
      this.logger.log(
        `Legacy plugin installations migrated to admin (${admin.username}): ${dirRows.length}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Legacy plugin migration skipped: ${message}`);
    }
  }

  // ===== 统一插件结构：内置插件生成标准插件包 =====

  private get pluginsRoot(): string {
    return path.join(process.cwd(), 'user-data', 'plugins');
  }

  /**
   * 为内置插件生成标准插件包，与线上市场安装的插件保持同一目录结构：
   *   user-data/plugins/<pluginKey>/
   *     ├── manifest.json   （市场清单声明，MarketPluginDef 格式）
   *     ├── plugin.js       （入口文件：内置插件为平台代码集成型，此文件为占位说明）
   *     └── README.md       （功能说明 / 页面入口 / 数据位置 / 使用方式）
   *
   * 幂等策略：仅当 manifest.json 缺失时才生成（避免每次启动覆盖「提交到插件市场」
   * 写回的版本号/描述，或用户手动维护的内容）；文件已存在则保持不动。
   */
  private ensureSeedPluginPackage(seed: SeedPluginDef): void {
    try {
      const dir = path.join(this.pluginsRoot, seed.pluginKey);
      fs.mkdirSync(dir, { recursive: true });
      const cfg = seed.config;
      const manifestPath = path.join(dir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        // 已存在标准包（含已提交/手动维护的版本号），跳过生成，保留现有内容
        return;
      }

      const manifest = {
        pluginKey: seed.pluginKey,
        name: seed.name,
        description: seed.description,
        version: seed.version,
        category: seed.category === 'core' ? '核心模块' : seed.category,
        cardIcon: cfg.cardIcon || 'puzzle',
        routePath: cfg.routePath || '/',
        gradientFrom: cfg.gradientFrom || '#6366f1',
        gradientTo: cfg.gradientTo || '#8b5cf6',
        entry: 'plugin.js',
        files: ['plugin.js', 'README.md'],
      };

      fs.writeFileSync(
        path.join(dir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8',
      );

      const pluginJs = `/**
 * ${seed.name}（${seed.pluginKey}）— 平台内置集成插件
 *
 * 本插件为 Life-OS 平台内置实现：前端页面与后端逻辑已深度集成在主工程代码中
 * （client/src 页面组件 + server/modules 业务模块），并非独立分发的 plugin.js 运行时。
 *
 * 本文件仅为满足插件市场统一结构而生成的入口占位文件，安装/卸载由插件中心
 * 的「启用 / 暂停 / 卸载」生命周期统一管理。
 *
 * 版本：${seed.version}
 * 入口页面：${cfg.routePath || '/'}
 */
'use strict';

module.exports = {
  key: '${seed.pluginKey}',
  name: '${seed.name}',
  version: '${seed.version}',
  builtin: true,
  routePath: '${cfg.routePath || '/'}',
};
`;

      fs.writeFileSync(path.join(dir, 'plugin.js'), pluginJs, 'utf-8');

      const readme = `# ${seed.name}

> ${seed.description}

## 基本信息

| 字段 | 值 |
| --- | --- |
| 插件 Key | \`${seed.pluginKey}\` |
| 版本 | ${seed.version} |
| 分类 | ${seed.category} |
| 入口页面 | \`${cfg.routePath || '/'}\` |
| 类型 | 平台内置集成插件 |

## 说明

本插件为 Life-OS 平台内置集成插件，页面与后端逻辑随主工程一起开发维护，
由「插件中心」统一管理启用 / 暂停 / 卸载。

## 页面入口

访问 \`${cfg.routePath || '/'}\` 进入插件主页面。

## 数据存储

${seed.pluginKey === 'dsh-plugin-child-tv'
  ? '插件数据保存在插件自身目录下 \`user-data/plugins/dsh-plugin-child-tv/data/\`，控制台提供「打开所在文件夹」（快捷键 Ctrl+Shift+O）快捷定位。'
  : '插件数据保存在本地 \`user-data/plugins-data/' + seed.pluginKey + '/\` 目录，'}
遵循「本地文件存储优先，后期可切换线上数据库」的项目规则。

## 使用方式

- 在插件中心启用后，侧边栏导航将自动出现对应菜单；
- 插件暴露的 AI 方法可在 AI 聊天框中使用自然语言调用（在插件中心详情页可查看方法列表）。
`;

      fs.writeFileSync(path.join(dir, 'README.md'), readme, 'utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to generate plugin package for ${seed.pluginKey}: ${message}`,
      );
    }
  }

  /** 目录全部插件，附当前用户装载状态（enabled/lifecycleStatus 取用户装载表） */
  async findAll(userId?: string): Promise<{ items: PluginConfig[]; total: number }> {
    const rows = await this.db.select().from(lifePluginConfig);
    const items: PluginConfig[] = [];
    for (const row of rows) {
      items.push(await this.mapRowWithUserState(row, userId));
    }
    return { items, total: items.length };
  }

  async getAvailablePlugins(userId?: string): Promise<{ items: AvailablePlugin[]; total: number }> {
    const rows = await this.db.select().from(lifePluginConfig);
    const items: AvailablePlugin[] = [];
    for (const row of rows) {
      const cfg = (row.config ?? {}) as Record<string, unknown>;
      const category = typeof cfg.category === 'string' ? cfg.category : 'other';
      const seed = SEED_PLUGINS.find((s) => s.pluginKey === row.pluginKey);
      const userState = await this.getUserInstallation(userId, row.pluginKey);
      items.push({
        pluginKey: row.pluginKey,
        name: row.name,
        description: row.description ?? '',
        version: row.version ?? '',
        category,
        isCore: row.pluginKey === CORE_PLUGIN_KEY,
        config: this.stripCategoryFromConfig(cfg),
        installed: userState?.enabled ?? false,
        lifecycleStatus: (userState?.lifecycleStatus ?? 'discovered') as PluginLifecycleStatus,
        riskLevel: row.riskLevel as 'low' | 'medium' | 'high',
        analyzable: seed?.analyzable ?? false,
        analysisLabel: seed?.analysisLabel,
      });
    }
    return { items, total: items.length };
  }

  async getInstalledPlugins(userId?: string): Promise<{ items: InstalledPlugin[]; total: number }> {
    if (!userId) return { items: [], total: 0 };
    // 当前用户已装载 = 启用中（enabled=true）或已暂停（suspended）；
    // 暂停的插件保留在列表中以便一键恢复，从未装载的插件不列入（走市场/插件中心「安装」）
    const states = await this.db
      .select()
      .from(lifePluginInstallations)
      .where(
        and(
          eq(lifePluginInstallations.userId, userId),
          or(
            eq(lifePluginInstallations.enabled, true),
            eq(lifePluginInstallations.lifecycleStatus, 'suspended'),
          ),
        ),
      );
    const items: InstalledPlugin[] = [];
    for (const state of states) {
      const dirRows = await this.db
        .select()
        .from(lifePluginConfig)
        .where(eq(lifePluginConfig.pluginKey, state.pluginKey));
      if (dirRows.length === 0) continue;
      const row = dirRows[0];
      items.push({
        ...(await this.mapRowWithUserState(row, userId)),
        installedAt: state.installedAt
          ? state.installedAt.toISOString()
          : (state.createdAt ? state.createdAt.toISOString() : ''),
        isCore: row.pluginKey === CORE_PLUGIN_KEY,
      });
    }
    return { items, total: items.length };
  }

  async installPlugin(pluginKey: string, userId?: string): Promise<PluginConfig> {
    try {
      if (!userId) {
        throw new BadRequestException('缺少用户上下文，无法装载插件');
      }
      const dirRows = await this.db
        .select()
        .from(lifePluginConfig)
        .where(eq(lifePluginConfig.pluginKey, pluginKey));
      if (dirRows.length === 0) {
        throw new NotFoundException('插件不存在或不在可用列表中');
      }
      const row = dirRows[0];

      const existing = await this.getUserInstallation(userId, pluginKey);
      if (existing?.enabled) {
        throw new ConflictException('插件已安装且处于启用状态');
      }

      await this.db
        .insert(lifePluginInstallations)
        .values({
          userId,
          pluginKey,
          enabled: true,
          lifecycleStatus: 'loading',
          installedAt: existing?.installedAt ?? new Date(),
        })
        .onConflictDoUpdate({
          target: [lifePluginInstallations.userId, lifePluginInstallations.pluginKey],
          set: { enabled: true, lifecycleStatus: 'loading' },
        });

      const wasGlobalActive = await this.countActiveUsers(pluginKey) > 1;
      setTimeout(() => {
        this.db
          .update(lifePluginInstallations)
          .set({ lifecycleStatus: 'active' })
          .where(
            and(
              eq(lifePluginInstallations.userId, userId),
              eq(lifePluginInstallations.pluginKey, pluginKey),
            ),
          )
          .then(() => {
            // 仅当该插件此前全局无任何用户装载时，才装载云函数（全局共享一份运行时）
            if (!wasGlobalActive) {
              return this.pluginRuntime.load(pluginKey);
            }
            return undefined;
          })
          .catch((err) => {
            this.logger.error(`Failed to activate plugin ${pluginKey}: ${String(err)}`);
          });
      }, 300);

      this.logger.log(`Plugin installed for user ${userId}: ${pluginKey}`);
      void this.lifeLogService.append({
        eventType: 'plugin_installed',
        eventCategory: 'plugins',
        contentSummary: `安装插件：${row.name}`,
        metadata: { pluginKey },
      }, userId ?? '');

      return this.mapRowWithUserState(row, userId);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to install plugin ${pluginKey}: ${message}`, stack);
      throw error;
    }
  }

  async uninstallPlugin(pluginKey: string, userId?: string): Promise<{ success: boolean }> {
    try {
      if (pluginKey === CORE_PLUGIN_KEY) {
        throw new BadRequestException('核心插件不可卸载');
      }
      if (!userId) {
        throw new BadRequestException('缺少用户上下文，无法卸载插件');
      }

      const dirRows = await this.db
        .select()
        .from(lifePluginConfig)
        .where(eq(lifePluginConfig.pluginKey, pluginKey));
      if (dirRows.length === 0) {
        throw new NotFoundException('插件未安装');
      }
      const pluginName = dirRows[0].name;

      const existing = await this.getUserInstallation(userId, pluginKey);
      if (!existing) {
        throw new NotFoundException('该用户未装载此插件');
      }

      await this.db
        .delete(lifePluginInstallations)
        .where(
          and(
            eq(lifePluginInstallations.userId, userId),
            eq(lifePluginInstallations.pluginKey, pluginKey),
          ),
        );

      this.logger.log(`Plugin uninstalled for user ${userId}: ${pluginKey}`);
      // 全局已无任何用户装载 → 注销云函数（保留数据目录）
      if (await this.countActiveUsers(pluginKey) === 0) {
        await this.pluginRuntime.unload(pluginKey);
      }
      void this.lifeLogService.append({
        eventType: 'plugin_uninstalled',
        eventCategory: 'plugins',
        contentSummary: `卸载插件：${pluginName}`,
        metadata: { pluginKey },
      }, userId ?? '');

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

  async suspendPlugin(pluginKey: string, userId?: string): Promise<PluginConfig> {
    const dirRows = await this.db
      .select()
      .from(lifePluginConfig)
      .where(eq(lifePluginConfig.pluginKey, pluginKey));
    if (dirRows.length === 0) {
      throw new NotFoundException('插件不存在');
    }
    const existing = await this.getUserInstallation(userId, pluginKey);
    if (!existing) {
      throw new NotFoundException('该用户未装载此插件');
    }
    if (existing.lifecycleStatus !== 'active') {
      throw new BadRequestException('只有处于运行中的插件才能暂停');
    }
    if (pluginKey === CORE_PLUGIN_KEY) {
      throw new BadRequestException('核心插件不可暂停');
    }

    await this.db
      .update(lifePluginInstallations)
      .set({ lifecycleStatus: 'suspended', enabled: false })
      .where(
        and(
          eq(lifePluginInstallations.userId, userId),
          eq(lifePluginInstallations.pluginKey, pluginKey),
        ),
      );

    this.logger.log(`Plugin suspended for user ${userId}: ${pluginKey}`);
    // 全局已无任何用户启用 → 注销云函数 + 通知内置模块停止（如 child-tv 定时调度）
    if (await this.countActiveUsers(pluginKey) === 0) {
      await this.pluginRuntime.unload(pluginKey);
      try {
        await this.childTvService?.onPluginSuspended?.();
      } catch (err) {
        this.logger.warn(`Failed to notify builtin module on suspend ${pluginKey}: ${String(err)}`);
      }
    }
    void this.lifeLogService.append({
      eventType: 'plugin_suspended',
      eventCategory: 'plugins',
      contentSummary: `暂停插件：${dirRows[0].name}`,
      metadata: { pluginKey },
    }, userId ?? '');

    return this.mapRowWithUserState(dirRows[0], userId);
  }

  async resumePlugin(pluginKey: string, userId?: string): Promise<PluginConfig> {
    const dirRows = await this.db
      .select()
      .from(lifePluginConfig)
      .where(eq(lifePluginConfig.pluginKey, pluginKey));
    if (dirRows.length === 0) {
      throw new NotFoundException('插件不存在');
    }
    const existing = await this.getUserInstallation(userId, pluginKey);
    if (!existing) {
      throw new NotFoundException('该用户未装载此插件');
    }
    if (existing.lifecycleStatus !== 'suspended') {
      throw new BadRequestException('只有处于暂停状态的插件才能恢复');
    }

    await this.db
      .update(lifePluginInstallations)
      .set({ lifecycleStatus: 'active', enabled: true })
      .where(
        and(
          eq(lifePluginInstallations.userId, userId),
          eq(lifePluginInstallations.pluginKey, pluginKey),
        ),
      );

    this.logger.log(`Plugin resumed for user ${userId}: ${pluginKey}`);
    // 恢复：装载云函数 + 通知内置模块重启（幂等：已加载则跳过）
    await this.pluginRuntime.load(pluginKey);
    try {
      await this.childTvService?.onPluginResumed?.();
    } catch (err) {
      this.logger.warn(`Failed to notify builtin module on resume ${pluginKey}: ${String(err)}`);
    }
    void this.lifeLogService.append({
      eventType: 'plugin_resumed',
      eventCategory: 'plugins',
      contentSummary: `恢复插件：${dirRows[0].name}`,
      metadata: { pluginKey },
    }, userId ?? '');

    return this.mapRowWithUserState(dirRows[0], userId);
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

  async getDshProfile(userId?: string): Promise<{
    platformName: string;
    version: string;
    theme: string;
    plugins: PluginConfig[];
  }> {
    const { items } = await this.findAll(userId);
    return {
      platformName: 'Life-OS',
      version: '1.0.0',
      theme: 'dark-minimal',
      plugins: items,
    };
  }

  // ===== 用户装载状态 helpers =====

  /** 取某用户对某插件的装载记录（无记录返回 null） */
  private async getUserInstallation(
    userId: string | undefined,
    pluginKey: string,
  ): Promise<(typeof lifePluginInstallations.$inferSelect) | null> {
    if (!userId) return null;
    const rows = await this.db
      .select()
      .from(lifePluginInstallations)
      .where(
        and(
          eq(lifePluginInstallations.userId, userId),
          eq(lifePluginInstallations.pluginKey, pluginKey),
        ),
      );
    return rows[0] ?? null;
  }

  /** 全局还有多少用户启用该插件（enabled=true 的装载记录数） */
  private async countActiveUsers(pluginKey: string): Promise<number> {
    const rows = await this.db
      .select()
      .from(lifePluginInstallations)
      .where(
        and(
          eq(lifePluginInstallations.pluginKey, pluginKey),
          eq(lifePluginInstallations.enabled, true),
        ),
      );
    return rows.length;
  }

  /** 目录行 + 当前用户装载状态合成 PluginConfig（enabled/lifecycleStatus 取用户视角） */
  private async mapRowWithUserState(
    row: typeof lifePluginConfig.$inferSelect,
    userId?: string,
  ): Promise<PluginConfig> {
    const userState = await this.getUserInstallation(userId, row.pluginKey);
    const cfg = (row.config ?? {}) as Record<string, unknown>;
    const caps = Array.isArray(row.capabilities) ? (row.capabilities as string[]) : [];
    const seed = SEED_PLUGINS.find((s) => s.pluginKey === row.pluginKey);
    return {
      id: row.id,
      pluginKey: row.pluginKey,
      name: row.name,
      description: row.description,
      enabled: userState?.enabled ?? false,
      version: row.version,
      config: this.stripCategoryFromConfig(cfg),
      lifecycleStatus: (userState?.lifecycleStatus ?? 'discovered') as PluginLifecycleStatus,
      riskLevel: (row.riskLevel ?? 'low') as 'low' | 'medium' | 'high',
      capabilities: caps,
      analyzable: seed?.analyzable ?? false,
      analysisLabel: seed?.analysisLabel,
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


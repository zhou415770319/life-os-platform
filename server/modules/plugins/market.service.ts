import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { LOCAL_DATABASE } from '@server/storage/local-database.module';
import type { LocalDatabase } from '@server/storage/local-database';
import { eq } from '@server/storage/drizzle-compat';
import { lifePluginConfig } from '@server/database/schema';
import type {
  PluginConfig,
  PluginCardConfig,
  MarketPluginDef,
  MarketPluginItem,
  PluginMethod,
} from '@shared/api.interface';
import { LifeLogService } from '@server/modules/life-log/life-log.service';
import { PluginMethodRegistry } from './plugin-method.registry';

const MARKET_OWNER = 'zhou415770319';
const MARKET_REPO = 'life-os-plugins';
const MARKET_BRANCH = 'main';
/** 市场插件在 config.source 中的标记 */
const MARKET_SOURCE_TAG = 'market';

interface MarketIndex {
  schemaVersion?: number;
  source?: string;
  plugins: MarketPluginDef[];
}

type MarketMethod = PluginMethod & { kind: string; collection: string };

@Injectable()
export class MarketService implements OnModuleInit {
  private readonly logger = new Logger(MarketService.name);
  private indexCache: { ts: number; index: MarketIndex | null } = { ts: 0, index: null };
  private readonly CACHE_TTL_MS = 10 * 60 * 1000;

  constructor(
    @Inject(LOCAL_DATABASE) private readonly db: LocalDatabase,
    private readonly lifeLogService: LifeLogService,
    private readonly registry: PluginMethodRegistry,
  ) {}

  private get pluginsRoot(): string {
    return path.join(process.cwd(), 'user-data', 'plugins');
  }

  private get dataRoot(): string {
    return path.join(process.cwd(), 'user-data', 'plugins-data');
  }

  private pluginDir(pluginKey: string): string {
    return path.join(this.pluginsRoot, pluginKey);
  }

  private pluginDataDir(pluginKey: string): string {
    return path.join(this.dataRoot, pluginKey);
  }

  private rawUrl(pluginKey: string, file: string): string {
    return `https://raw.githubusercontent.com/${MARKET_OWNER}/${MARKET_REPO}/${MARKET_BRANCH}/plugins/${pluginKey}/${file}`;
  }

  private indexUrl(): string {
    return `https://raw.githubusercontent.com/${MARKET_OWNER}/${MARKET_REPO}/${MARKET_BRANCH}/plugins/index.json`;
  }

  /** 仓库内相对路径的多个可访问镜像（GitHub 直连不稳时自动回退） */
  private mirrorUrls(relPath: string): string[] {
    const raw = `https://raw.githubusercontent.com/${MARKET_OWNER}/${MARKET_REPO}/${MARKET_BRANCH}/${relPath}`;
    return [
      raw,
      `https://cdn.jsdelivr.net/gh/${MARKET_OWNER}/${MARKET_REPO}@${MARKET_BRANCH}/${relPath}`,
      `https://ghproxy.net/${raw}`,
    ];
  }

  private async fetchFirst(relPath: string): Promise<{ text: string; ok: boolean; used: string }> {
    let lastError = '';
    for (const url of this.mirrorUrls(relPath)) {
      try {
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (res.ok) return { text: await res.text(), ok: true, used: url };
        lastError = `HTTP ${res.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    return { text: lastError, ok: false, used: '' };
  }

  // ===== 启动恢复：已安装市场插件的 AI 方法 =====

  async onModuleInit(): Promise<void> {
    try {
      const rows = await this.db.select().from(lifePluginConfig);
      let restored = 0;
      for (const row of rows) {
        const cfg = (row.config ?? {}) as Record<string, unknown>;
        if (cfg.source !== MARKET_SOURCE_TAG || !row.enabled) continue;
        const manifest = this.readManifest(row.pluginKey);
        if (manifest?.aiMethods?.length) {
          this.registry.registerMarketMethods(
            row.pluginKey,
            manifest.aiMethods,
            (m, args, userId) => this.executeMarketMethod(row.pluginKey, m, args, userId),
          );
          restored++;
        }
      }
      this.logger.log(`MarketService ready, ${restored} market plugin method groups restored`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`MarketService init failed: ${message}`);
    }
  }

  // ===== 市场清单 =====

  async fetchIndex(force = false): Promise<MarketIndex> {
    const now = Date.now();
    if (!force && this.indexCache.index && now - this.indexCache.ts < this.CACHE_TTL_MS) {
      return this.indexCache.index;
    }
    try {
      const { text, ok, used } = await this.fetchFirst('plugins/index.json');
      if (!ok) {
        // 网络失败时降级返回缓存
        if (this.indexCache.index) {
          this.logger.warn(`Market index fetch failed (${text}), using cache`);
          return this.indexCache.index;
        }
        throw new BadRequestException(`插件市场拉取失败（${text}），请检查网络或仓库配置`);
      }
      this.logger.debug(`Market index fetched from ${used}`);
      const index = JSON.parse(text) as MarketIndex;
      if (!Array.isArray(index.plugins)) {
        throw new BadRequestException('插件市场清单格式错误（缺少 plugins 数组）');
      }
      this.indexCache = { ts: now, index };
      return index;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (this.indexCache.index) {
        this.logger.warn(`Market index fetch error, using cache: ${error instanceof Error ? error.message : String(error)}`);
        return this.indexCache.index;
      }
      throw new BadRequestException('无法连接插件市场（GitHub 仓库不可达），请检查网络后重试');
    }
  }

  async listMarketPlugins(): Promise<{ items: MarketPluginItem[]; total: number }> {
    const index = await this.fetchIndex();
    const rows = await this.db.select().from(lifePluginConfig);
    const rowMap = new Map(rows.map((r) => [r.pluginKey, r]));
    const items: MarketPluginItem[] = index.plugins.map((def) => {
      const row = rowMap.get(def.pluginKey);
      return {
        ...def,
        installed: !!row && row.enabled,
        enabled: !!row && row.enabled,
        installedVersion: row?.version ?? null,
      };
    });
    return { items, total: items.length };
  }

  // ===== 安装 / 卸载 / 更新 =====

  async install(pluginKey: string): Promise<PluginConfig> {
    const index = await this.fetchIndex();
    const def = index.plugins.find((p) => p.pluginKey === pluginKey);
    if (!def) {
      throw new NotFoundException(`市场插件「${pluginKey}」不存在`);
    }

    // 下载插件文件到 user-data/plugins/<key>/（manifest.json 为必需文件，强制包含）
    const dir = this.pluginDir(pluginKey);
    fs.mkdirSync(dir, { recursive: true });
    const filesToDownload = Array.from(new Set(['manifest.json', ...(def.files ?? [])]));
    for (const file of filesToDownload) {
      const { text, ok, used } = await this.fetchFirst(`plugins/${pluginKey}/${file}`);
      if (!ok) {
        throw new BadRequestException(
          `下载插件文件 ${file} 失败（${text}），请检查网络后重试`,
        );
      }
      // 防路径穿越：只允许下载到插件目录根（文件名取 basename）
      const safeName = path.basename(file);
      fs.writeFileSync(path.join(dir, safeName), text, 'utf-8');
      this.logger.debug(`Downloaded ${pluginKey}/${safeName} via ${used} (${text.length} bytes)`);
    }

    // 校验 manifest
    const manifest = this.readManifest(pluginKey);
    if (!manifest) {
      throw new BadRequestException('插件 manifest.json 缺失或无法解析，安装中止');
    }
    if (manifest.pluginKey !== pluginKey) {
      throw new BadRequestException(`manifest pluginKey（${manifest.pluginKey}）与目录不一致`);
    }

    const config: PluginCardConfig & { source: string; category: string } = {
      category: manifest.category || 'other',
      cardTitle: manifest.name,
      cardDescription: manifest.description,
      cardIcon: manifest.cardIcon || 'puzzle',
      routePath: manifest.routePath,
      gradientFrom: manifest.gradientFrom || '#6366f1',
      gradientTo: manifest.gradientTo || '#8b5cf6',
      source: MARKET_SOURCE_TAG,
    };

    const existing = await this.db
      .select()
      .from(lifePluginConfig)
      .where(eq(lifePluginConfig.pluginKey, pluginKey));

    let row: (typeof lifePluginConfig.$inferSelect) | undefined;
    if (existing.length > 0) {
      const updated = await this.db
        .update(lifePluginConfig)
        .set({
          enabled: true,
          lifecycleStatus: 'active',
          version: manifest.version,
          name: manifest.name,
          description: manifest.description,
          config,
          riskLevel: 'medium',
        })
        .where(eq(lifePluginConfig.pluginKey, pluginKey))
        .returning();
      row = updated[0];
    } else {
      const inserted = await this.db
        .insert(lifePluginConfig)
        .values({
          pluginKey,
          name: manifest.name,
          description: manifest.description,
          enabled: true,
          version: manifest.version,
          config,
          lifecycleStatus: 'active',
          riskLevel: 'medium',
          capabilities: ['market-plugin'],
        })
        .returning();
      row = inserted[0];
    }

    if (!row) {
      throw new NotFoundException('插件记录写入失败');
    }

    // 注册 AI 方法
    if (manifest.aiMethods?.length) {
      this.registry.registerMarketMethods(
        pluginKey,
        manifest.aiMethods,
        (m, args, userId) => this.executeMarketMethod(pluginKey, m, args, userId),
      );
    }

    this.logger.log(`Market plugin installed: ${pluginKey}@${manifest.version}`);
    void this.lifeLogService.append({
      eventType: 'plugin_installed',
      eventCategory: 'plugins',
      contentSummary: `从插件市场安装：${manifest.name} v${manifest.version}`,
      metadata: { pluginKey, source: 'market' },
    });

    return this.toPluginConfig(row);
  }

  async uninstall(pluginKey: string): Promise<{ success: boolean }> {
    const rows = await this.db
      .select()
      .from(lifePluginConfig)
      .where(eq(lifePluginConfig.pluginKey, pluginKey));
    if (rows.length === 0 || (rows[0].config ?? {}).source !== MARKET_SOURCE_TAG) {
      throw new BadRequestException('该插件不是市场插件，请通过插件中心卸载');
    }

    // 删除插件文件目录（保留数据目录，重装可恢复）
    const dir = this.pluginDir(pluginKey);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }

    await this.db
      .update(lifePluginConfig)
      .set({ enabled: false, lifecycleStatus: 'unloaded' })
      .where(eq(lifePluginConfig.pluginKey, pluginKey));

    this.logger.log(`Market plugin uninstalled: ${pluginKey}`);
    void this.lifeLogService.append({
      eventType: 'plugin_uninstalled',
      eventCategory: 'plugins',
      contentSummary: `卸载市场插件：${rows[0].name}`,
      metadata: { pluginKey, source: 'market' },
    });

    return { success: true };
  }

  async update(pluginKey: string): Promise<PluginConfig> {
    const index = await this.fetchIndex(true);
    const def = index.plugins.find((p) => p.pluginKey === pluginKey);
    if (!def) {
      throw new NotFoundException(`市场插件「${pluginKey}」不存在`);
    }
    const current = await this.db
      .select()
      .from(lifePluginConfig)
      .where(eq(lifePluginConfig.pluginKey, pluginKey));
    if (current.length === 0 || (current[0].config ?? {}).source !== MARKET_SOURCE_TAG) {
      throw new BadRequestException('该插件未从市场安装，无法更新');
    }

    // 重新下载全部文件覆盖（manifest.json 为必需文件，强制包含）
    const dir = this.pluginDir(pluginKey);
    fs.mkdirSync(dir, { recursive: true });
    const filesToDownload = Array.from(new Set(['manifest.json', ...(def.files ?? [])]));
    for (const file of filesToDownload) {
      const { text, ok } = await this.fetchFirst(`plugins/${pluginKey}/${file}`);
      if (!ok) {
        throw new BadRequestException(
          `更新插件文件 ${file} 失败（${text}），请检查网络后重试`,
        );
      }
      fs.writeFileSync(path.join(dir, path.basename(file)), text, 'utf-8');
    }

    const manifest = this.readManifest(pluginKey);
    if (!manifest || manifest.pluginKey !== pluginKey) {
      throw new BadRequestException('更新后的 manifest 缺失或不一致，已保留旧版本文件');
    }

    const updated = await this.db
      .update(lifePluginConfig)
      .set({ version: manifest.version, name: manifest.name, description: manifest.description })
      .where(eq(lifePluginConfig.pluginKey, pluginKey))
      .returning();

    if (manifest.aiMethods?.length) {
      this.registry.registerMarketMethods(
        pluginKey,
        manifest.aiMethods,
        (m, args, userId) => this.executeMarketMethod(pluginKey, m, args, userId),
      );
    }

    this.logger.log(`Market plugin updated: ${pluginKey} -> v${manifest.version}`);
    return this.toPluginConfig(updated[0]);
  }

  // ===== 插件文件服务（前端 PluginHost 动态加载入口 JS） =====

  async serveFile(pluginKey: string, file: string): Promise<{ content: string; ext: string }> {
    const safeName = path.basename(file);
    const fp = path.join(this.pluginDir(pluginKey), safeName);
    if (!fs.existsSync(fp)) {
      throw new NotFoundException(`插件文件不存在：${pluginKey}/${safeName}`);
    }
    const content = fs.readFileSync(fp, 'utf-8');
    return { content, ext: path.extname(safeName).toLowerCase() };
  }

  // ===== 通用数据 API（插件页面 + AI 方法共用） =====

  private collectionFile(pluginKey: string, collection: string): string {
    return path.join(this.pluginDataDir(pluginKey), `${collection}.json`);
  }

  private readCollection(pluginKey: string, collection: string): any[] {
    const fp = this.collectionFile(pluginKey, collection);
    if (!fs.existsSync(fp)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeCollection(pluginKey: string, collection: string, rows: any[]): void {
    const fp = this.collectionFile(pluginKey, collection);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(rows, null, 2), 'utf-8');
  }

  private async assertMarketPluginEnabled(pluginKey: string): Promise<void> {
    const rows = await this.db
      .select()
      .from(lifePluginConfig)
      .where(eq(lifePluginConfig.pluginKey, pluginKey));
    if (rows.length === 0 || !rows[0].enabled) {
      throw new ForbiddenException(`插件「${pluginKey}」未安装或未启用`);
    }
  }

  async getCollection(pluginKey: string, collection: string): Promise<{ items: any[]; total: number }> {
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(collection)) {
      throw new BadRequestException('数据集合名不合法');
    }
    await this.assertMarketPluginEnabled(pluginKey);
    const items = this.readCollection(pluginKey, collection);
    return { items, total: items.length };
  }

  async mutateCollection(
    pluginKey: string,
    collection: string,
    op: string,
    data: Record<string, unknown>,
  ): Promise<unknown> {
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(collection)) {
      throw new BadRequestException('数据集合名不合法');
    }
    await this.assertMarketPluginEnabled(pluginKey);

    const rows = this.readCollection(pluginKey, collection);
    if (op === 'add') {
      const row = {
        ...(data ?? {}),
        id: typeof data?.id === 'string' ? data.id : randomUUID(),
        createdAt: new Date().toISOString(),
      };
      rows.push(row);
      this.writeCollection(pluginKey, collection, rows);
      return row;
    }
    if (op === 'update') {
      const id = data?.id;
      if (typeof id !== 'string' || !id) {
        throw new BadRequestException('修改记录必须提供 id');
      }
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) {
        throw new NotFoundException(`记录 ${id} 不存在`);
      }
      rows[idx] = { ...rows[idx], ...data, id };
      this.writeCollection(pluginKey, collection, rows);
      return rows[idx];
    }
    if (op === 'delete') {
      const id = data?.id;
      if (typeof id !== 'string' || !id) {
        throw new BadRequestException('删除记录必须提供 id');
      }
      const next = rows.filter((r) => r.id !== id);
      this.writeCollection(pluginKey, collection, next);
      return { success: true, deleted: rows.length - next.length };
    }
    throw new BadRequestException(`不支持的操作类型：${op}`);
  }

  // ===== AI 方法执行（通用数据操作） =====

  async executeMarketMethod(
    pluginKey: string,
    method: MarketMethod,
    args: Record<string, unknown>,
    _userId: string,
  ): Promise<unknown> {
    switch (method.kind) {
      case 'add':
        return this.mutateCollection(pluginKey, method.collection, 'add', args);
      case 'list':
        return this.getCollection(pluginKey, method.collection);
      case 'update':
        return this.mutateCollection(pluginKey, method.collection, 'update', args);
      case 'delete':
        return this.mutateCollection(pluginKey, method.collection, 'delete', args);
      default:
        throw new BadRequestException(`未知方法类型：${method.kind}`);
    }
  }

  // ===== 内部工具 =====

  private readManifest(pluginKey: string): MarketPluginDef | null {
    const fp = path.join(this.pluginDir(pluginKey), 'manifest.json');
    if (!fs.existsSync(fp)) return null;
    try {
      return JSON.parse(fs.readFileSync(fp, 'utf-8')) as MarketPluginDef;
    } catch {
      return null;
    }
  }

  private toPluginConfig(row: (typeof lifePluginConfig.$inferSelect)): PluginConfig {
    const cfg = (row.config ?? {}) as Record<string, unknown>;
    const { category, ...rest } = cfg;
    void category;
    return {
      id: row.id,
      pluginKey: row.pluginKey,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      version: row.version,
      config: (rest as unknown) as PluginCardConfig,
      lifecycleStatus: (row.lifecycleStatus ?? 'discovered') as PluginConfig['lifecycleStatus'],
      riskLevel: (row.riskLevel ?? 'low') as PluginConfig['riskLevel'],
      capabilities: Array.isArray(row.capabilities) ? (row.capabilities as string[]) : [],
    };
  }
}

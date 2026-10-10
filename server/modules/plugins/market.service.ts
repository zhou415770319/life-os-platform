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
import { spawn } from 'child_process';
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
    // 注册系统级方法：提交插件到市场（AI 聊天可调用，不依赖插件安装状态）
    this.registry.registerSystemMethod(
      {
        id: 'life-os.submitPluginToMarket',
        name: '提交插件到市场',
        description:
          '把本地已安装的插件提交到 GitHub 插件市场仓库：基于 main 新建分支、上传插件文件并更新市场清单、创建 Pull Request 请求仓库管理员 review 审核（不自动合并）',
        pluginKey: 'life-os',
        params: [
          {
            name: 'pluginKey',
            type: 'string',
            required: true,
            description: '要提交的插件 key（插件唯一标识，如 reading-notes）',
          },
        ],
      },
      async (args) => {
        return this.submitPlugin(String(args.pluginKey));
      },
    );

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

  // ===== 提交插件到市场（新建分支 + PR，由仓库管理员 review 合并） =====

  /**
   * 提交本地插件到 GitHub 插件市场：
   * 1. 读取本地 user-data/plugins/<key>/ 下的插件文件
   * 2. 基于 main 新建分支 submit/<key>-<时间戳>
   * 3. 分支上写入 plugins/<key>/* 并更新 plugins/index.json 市场清单
   * 4. 创建 Pull Request（base=main），请求仓库管理员 review 审核，不自动合并
   *
   * GitHub 凭据来源（按优先级）：环境变量 MARKET_GITHUB_TOKEN / GITHUB_TOKEN
   * → 本机 git 凭据（git credential fill，复用登录 GitHub 的账号）
   */
  async submitPlugin(pluginKey: string): Promise<Record<string, unknown>> {
    const safeKey = path.basename(pluginKey);
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(safeKey)) {
      throw new BadRequestException('插件 key 不合法');
    }

    const dir = this.pluginDir(safeKey);
    if (!fs.existsSync(dir)) {
      throw new NotFoundException(`本地插件目录不存在：user-data/plugins/${safeKey}`);
    }
    const manifest = this.readManifest(safeKey);
    if (!manifest) {
      throw new BadRequestException(`插件 ${safeKey} 的 manifest.json 缺失或无法解析，无法提交`);
    }

    // 本地插件根目录下的文件（防穿越：只取 basename）
    const files = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name);
    if (files.length === 0) {
      throw new BadRequestException('插件目录中没有文件，无法提交');
    }

    const token = await this.resolveGitHubToken();
    if (!token) {
      throw new ForbiddenException(
        '未找到可用的 GitHub 凭据。请设置环境变量 MARKET_GITHUB_TOKEN（或 GITHUB_TOKEN），' +
          '或确保本机已通过 git 登录 GitHub 账号。',
      );
    }

    const api = this.githubApi(token);
    const branch = `submit/${safeKey}-${this.timestamp()}`;

    try {
      // 1) 取 main 分支最新 sha
      const mainRef = await api.get<{ object: { sha: string } }>(
        `/repos/${MARKET_OWNER}/${MARKET_REPO}/git/ref/heads/${MARKET_BRANCH}`,
      );
      const baseSha = mainRef.object.sha;

      // 2) 创建新分支
      await api.post(`/repos/${MARKET_OWNER}/${MARKET_REPO}/git/refs`, {
        ref: `refs/heads/${branch}`,
        sha: baseSha,
      });

      // 3) 读取远程 index.json（main 分支），更新清单后写回新分支
      let indexB64 = '';
      let indexSha: string | null = null;
      try {
        const idx = await api.get<{ content: string; sha: string }>(
          `/repos/${MARKET_OWNER}/${MARKET_REPO}/contents/plugins/index.json?ref=${MARKET_BRANCH}`,
        );
        indexB64 = idx.content;
        indexSha = idx.sha;
      } catch {
        // 远程无 index.json 时按新仓库处理
      }

      const index = this.mergeIndexEntry(
        indexB64,
        {
          pluginKey: safeKey,
          name: manifest.name,
          description: manifest.description,
          version: manifest.version,
          routePath: manifest.routePath,
          category: manifest.category || 'other',
          cardIcon: manifest.cardIcon || 'puzzle',
          gradientFrom: manifest.gradientFrom,
          gradientTo: manifest.gradientTo,
          files,
          aiMethods: manifest.aiMethods,
        },
      );
      const newIndexB64 = Buffer.from(JSON.stringify(index, null, 2), 'utf-8').toString('base64');

      // 4) 上传插件文件到新分支
      const uploaded: string[] = [];
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const body: Record<string, unknown> = {
          message: `提交插件 ${safeKey}：${file}`,
          content: Buffer.from(content, 'utf-8').toString('base64'),
          branch,
        };
        // 若分支上已存在该文件则需带 sha（新分支一般不存在，带 sha 防止陈旧覆盖）
        try {
          const existing = await api.get<{ sha: string }>(
            `/repos/${MARKET_OWNER}/${MARKET_REPO}/contents/plugins/${safeKey}/${file}?ref=${branch}`,
          );
          body.sha = existing.sha;
        } catch {
          // 分支上无此文件，首次上传
        }
        await api.put(`/repos/${MARKET_OWNER}/${MARKET_REPO}/contents/plugins/${safeKey}/${file}`, body);
        uploaded.push(file);
      }

      // 5) 上传更新后的 index.json
      const indexBody: Record<string, unknown> = {
        message: `提交插件 ${safeKey}：更新市场清单`,
        content: newIndexB64,
        branch,
      };
      if (indexSha) indexBody.sha = indexSha;
      await api.put(`/repos/${MARKET_OWNER}/${MARKET_REPO}/contents/plugins/index.json`, indexBody);

      // 6) 创建 Pull Request（请求管理员 review，不自动合并）
      const pr = await api.post<{ number: number; html_url: string }>(
        `/repos/${MARKET_OWNER}/${MARKET_REPO}/pulls`,
        {
          title: `提交插件：${manifest.name}（${safeKey}）v${manifest.version}`,
          head: branch,
          base: MARKET_BRANCH,
          body: [
            `## 插件提交：${manifest.name}`,
            '',
            `- **插件 key**：${safeKey}`,
            `- **版本**：${manifest.version}`,
            `- **说明**：${manifest.description}`,
            `- **文件清单**：${uploaded.join('、')}`,
            '',
            '> 本 PR 由「人生系统」插件市场提交功能自动创建，请仓库管理员 review 审核后合并。',
          ].join('\n'),
        },
      );

      this.logger.log(`Plugin submitted to market: ${safeKey} -> branch ${branch}, PR #${pr.number}`);
      void this.lifeLogService.append({
        eventType: 'plugin_submitted',
        eventCategory: 'plugins',
        contentSummary: `提交插件到市场：${manifest.name} v${manifest.version}（PR #${pr.number}）`,
        metadata: { pluginKey: safeKey, branch, prNumber: pr.number, prUrl: pr.html_url },
      });

      return {
        success: true,
        pluginKey: safeKey,
        pluginName: manifest.name,
        version: manifest.version,
        branch,
        prNumber: pr.number,
        prUrl: pr.html_url,
        files: uploaded,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // 401/403 直接归因为凭据问题，避免暴露请求细节
      if (/401|403|Bad credentials/.test(message)) {
        throw new ForbiddenException('GitHub 凭据无效或权限不足，请检查 MARKET_GITHUB_TOKEN 或 git 登录状态');
      }
      throw new BadRequestException(`提交插件失败：${message}`);
    }
  }

  private timestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
      `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    );
  }

  /** 合并插件条目到市场清单（远程已有则更新，否则追加） */
  private mergeIndexEntry(indexB64: string, entry: MarketPluginDef): MarketIndex {
    let index: MarketIndex = { plugins: [] };
    if (indexB64) {
      try {
        index = JSON.parse(Buffer.from(indexB64, 'base64').toString('utf-8')) as MarketIndex;
      } catch {
        this.logger.warn('Remote index.json parse failed, rebuilding from scratch');
      }
    }
    if (!Array.isArray(index.plugins)) index.plugins = [];
    const idx = index.plugins.findIndex((p) => p.pluginKey === entry.pluginKey);
    if (idx >= 0) {
      index.plugins[idx] = entry;
    } else {
      index.plugins.push(entry);
    }
    index.schemaVersion = index.schemaVersion ?? 1;
    index.source = index.source ?? 'life-os';
    return index;
  }

  /** 解析 GitHub 凭据：环境变量优先，其次本机 git credential store */
  private async resolveGitHubToken(): Promise<string | null> {
    const fromEnv = process.env.MARKET_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
    if (fromEnv) return fromEnv;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve(null);
      }, 5000);
      const child = spawn('git', ['credential', 'fill'], {
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      let out = '';
      child.stdout.on('data', (chunk: Buffer) => {
        out += chunk.toString('utf-8');
      });
      child.on('error', () => {
        clearTimeout(timer);
        resolve(null);
      });
      child.on('close', () => {
        clearTimeout(timer);
        const m = out.match(/^password=(.+)$/m);
        resolve(m ? m[1].trim() : null);
      });
      child.stdin.write('protocol=https\nhost=github.com\n\n');
      child.stdin.end();
    });
  }

  private githubApi(token: string): {
    get: <T>(p: string) => Promise<T>;
    post: <T>(p: string, body: unknown) => Promise<T>;
    put: <T>(p: string, body: unknown) => Promise<T>;
  } {
    const base = 'https://api.github.com';
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'life-os-platform',
    };
    const request = async <T>(method: string, p: string, body?: unknown): Promise<T> => {
      const res = await fetch(`${base}${p}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`GitHub API ${res.status}: ${detail.slice(0, 300)}`);
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    };
    return {
      get: <T>(p: string) => request<T>('GET', p),
      post: <T>(p: string, body: unknown) => request<T>('POST', p, body),
      put: <T>(p: string, body: unknown) => request<T>('PUT', p, body),
    };
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

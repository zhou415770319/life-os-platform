import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { LOCAL_DATABASE } from '@server/storage/local-database.module';
import type { LocalDatabase } from '@server/storage/local-database';
import { lifePluginInstallations } from '@server/database/schema';
import { eq } from '@server/storage/drizzle-compat';
import type { PluginMethodParam } from '@shared/api.interface';
import { LocalCapabilityService } from '../../platform-local/local-capability.service';

/** 插件云函数方法定义（server.js 中声明） */
export interface CloudMethodDef {
  name: string;
  description: string;
  params?: PluginMethodParam[];
  dangerous?: boolean;
  handler: (
    args: Record<string, unknown>,
    ctx: PluginRuntimeContext,
  ) => Promise<unknown> | unknown;
}

/** 宿主注入给云函数的能力上下文（白名单，避免插件 import 宿主模块） */
export interface PluginRuntimeContext {
  userId: string;
  pluginKey: string;
  /** 插件数据目录（自动创建）：user-data/plugins/<key>/data */
  dataDir: string;
  logger: Logger;
  /** 拼接插件数据目录下的路径 */
  joinData: (...segments: string[]) => string;
  /** 读取插件数据目录下的 JSON（不存在返回 fallback） */
  readJson: <T>(file: string, fallback: T) => T;
  /** 写入插件数据目录下的 JSON */
  writeJson: (file: string, data: unknown) => void;
  /** 受限网络能力（宿主 fetch 包装，带超时） */
  http: (url: string, init?: RequestInit) => Promise<Response>;
  /** 大模型能力：插件可用模型完成任务（默认走「插件默认模型」分配） */
  llm: {
    chat: (input: {
      prompt: string;
      system?: string;
      /** 可选：指定用途或 providerId:modelId，默认 plugin */
      model?: string;
    }) => Promise<{ content: string }>;
  };
}

/** 插件 server.js 导出的模块结构 */
export interface CloudFunctionModule {
  methods?: CloudMethodDef[];
  onLoad?: (ctx: PluginRuntimeContext) => Promise<void> | void;
  onUnload?: (ctx: PluginRuntimeContext) => Promise<void> | void;
}

const DEFAULT_SERVER_ENTRY = 'server.js';

/**
 * 方法注册回调（由插件模块装配方注入，避免与注册表形成循环依赖）。
 * 装载时把云函数方法注册进注册表，卸载时批量注销。
 */
export interface DynamicMethodRegistrar {
  onRegister: (
    pluginKey: string,
    defs: CloudMethodDef[],
    buildCtx: (userId: string) => PluginRuntimeContext,
  ) => void;
  onUnregister: (pluginKey: string) => string[];
}

/**
 * 插件「云函数」运行时：
 * - 插件装载/启用 → 读取 server.js → onLoad → 注册 methods 进 PluginMethodRegistry
 * - 插件卸载/暂停 → 注销全部方法 → onUnload → 释放 require 缓存（保留数据目录）
 * 无需重启服务，方法注册后 AI 工具调用 / 参数预检 / 快捷功能自动生效。
 */
@Injectable()
export class PluginRuntimeService implements OnApplicationBootstrap {
  private readonly logger = new Logger('PluginRuntime');
  private readonly loaded = new Map<string, CloudFunctionModule>();
  private registrar: DynamicMethodRegistrar | null = null;

  constructor(
    @Inject(LOCAL_DATABASE)
    private readonly db: LocalDatabase,
    private readonly capabilityService: LocalCapabilityService,
  ) {}

  /** 装配方（插件模块）注入方法注册回调 */
  bindRegistrar(registrar: DynamicMethodRegistrar): void {
    this.registrar = registrar;
  }

  get pluginsRoot(): string {
    return path.join(process.cwd(), 'user-data', 'plugins');
  }

  private pluginDir(pluginKey: string): string {
    return path.join(this.pluginsRoot, pluginKey);
  }

  private readManifest(pluginKey: string): { serverEntry?: string } | null {
    try {
      const raw = fs.readFileSync(
        path.join(this.pluginDir(pluginKey), 'manifest.json'),
        'utf-8',
      );
      const parsed = JSON.parse(raw) as { serverEntry?: string };
      if (typeof parsed !== 'object' || parsed === null) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /** 应用启动后：扫描已装载插件（任意用户启用），补齐云函数注册 */
  async onApplicationBootstrap(): Promise<void> {
    try {
      // 装载表（按用户隔离）中有任一用户 enabled=true 即恢复该插件云函数；
      // 目录表 enabled 已不再承载运行状态
      const rows = await this.db
        .select({ pluginKey: lifePluginInstallations.pluginKey })
        .from(lifePluginInstallations)
        .where(eq(lifePluginInstallations.enabled, true));
      const keys = Array.from(new Set(rows.map((r) => r.pluginKey)));
      for (const pluginKey of keys) {
        await this.load(pluginKey);
      }
      this.logger.log(`PluginRuntime ready, cloud functions restored for ${keys.length} enabled plugins`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`PluginRuntime bootstrap failed: ${message}`);
    }
  }

  /**
   * 加载单个插件的云函数（幂等：已加载先卸载）。
   * @returns 是否注册了云函数方法
   */
  async load(pluginKey: string): Promise<boolean> {
    try {
      this.unload(pluginKey);

      const manifest = this.readManifest(pluginKey);
      const serverEntry = manifest?.serverEntry ?? DEFAULT_SERVER_ENTRY;
      const entryPath = path.join(this.pluginDir(pluginKey), serverEntry);
      if (!fs.existsSync(entryPath)) {
        return false; // 无云函数入口，跳过
      }

      // 清 require 缓存，保证热更新（重新装载/更新后加载最新代码）
      const resolved = require.resolve(entryPath);
      if (require.cache[resolved]) {
        delete require.cache[resolved];
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(entryPath) as CloudFunctionModule;
      const ctx = this.buildContext(pluginKey, 'system');

      if (typeof mod.onLoad === 'function') {
        await mod.onLoad(ctx);
      }

      if (Array.isArray(mod.methods) && mod.methods.length > 0) {
        this.registrar?.onRegister(
          pluginKey,
          mod.methods,
          (userId: string) => this.buildContext(pluginKey, userId),
        );
        this.loaded.set(pluginKey, mod);
        this.logger.log(`Cloud functions loaded for plugin: ${pluginKey}`);
        return true;
      }

      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to load cloud functions for ${pluginKey}: ${message}`);
      // 加载失败：回滚已注册方法，避免半装载状态
      this.unload(pluginKey);
      return false;
    }
  }

  /**
   * 卸载插件的云函数（幂等）：注销全部方法 + onUnload + 释放 require 缓存。
   * 数据目录保留（用户数据不随卸载删除）。
   */
  async unload(pluginKey: string): Promise<void> {
    const mod = this.loaded.get(pluginKey);
    if (mod) {
      try {
        if (typeof mod.onUnload === 'function') {
          await mod.onUnload(this.buildContext(pluginKey, 'system'));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`onUnload failed for ${pluginKey}: ${message}`);
      }
      this.loaded.delete(pluginKey);
    }

    const removed = this.registrar?.onUnregister(pluginKey) ?? [];

    // 释放 require 缓存
    try {
      const manifest = this.readManifest(pluginKey);
      const serverEntry = manifest?.serverEntry ?? DEFAULT_SERVER_ENTRY;
      const entryPath = path.join(this.pluginDir(pluginKey), serverEntry);
      const resolved = require.resolve(entryPath);
      if (require.cache[resolved]) {
        delete require.cache[resolved];
      }
    } catch {
      // 入口不存在时忽略
    }

    if (mod || removed.length > 0) {
      this.logger.log(`Cloud functions unloaded for plugin: ${pluginKey}`);
    }
  }

  /** 是否已加载云函数 */
  isLoaded(pluginKey: string): boolean {
    return this.loaded.has(pluginKey);
  }

  private buildContext(pluginKey: string, userId: string): PluginRuntimeContext {
    const dataDir = path.join(this.pluginDir(pluginKey), 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    const joinData = (...segments: string[]): string => {
      return path.join(dataDir, ...segments);
    };

    return {
      userId,
      pluginKey,
      dataDir,
      logger: this.logger,
      joinData,
      readJson: <T>(file: string, fallback: T): T => {
        const full = joinData(file);
        try {
          if (!fs.existsSync(full)) return fallback;
          return JSON.parse(fs.readFileSync(full, 'utf-8')) as T;
        } catch {
          return fallback;
        }
      },
      writeJson: (file: string, data: unknown): void => {
        const full = joinData(file);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, JSON.stringify(data, null, 2), 'utf-8');
      },
      http: (url: string, init?: RequestInit): Promise<Response> => {
        return fetch(url, {
          ...init,
          signal: AbortSignal.timeout(15000),
        });
      },
      llm: {
        chat: async (input: {
          prompt: string;
          system?: string;
          model?: string;
        }): Promise<{ content: string }> => {
          const content = await this.capabilityService.generateText(
            { system: input.system ?? '', prompt: input.prompt },
            { modelKey: input.model || 'plugin' },
          );
          return { content };
        },
      },
    };
  }
}

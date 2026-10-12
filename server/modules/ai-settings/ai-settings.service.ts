import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { AiModelAssignments, AiModelDef, AiProvider, AiUsageKey } from '@shared/api.interface';

export interface AiSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const DEFAULT_BASE_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';

export interface EffectiveAiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  source: 'user' | 'env' | 'none';
}

export interface ResolvedModelConfig extends EffectiveAiConfig {
  providerId?: string;
  providerName?: string;
  modelId?: string;
  usage?: AiUsageKey;
}

const USAGE_LABEL: Record<AiUsageKey, string> = {
  chat: '人生助手·普通模式',
  deep: '人生助手·深度模式',
  agent: '系统助手·创建插件',
  plugin: '插件默认模型',
};

/**
 * AI 模型服务配置（多平台，仿 Cherry Studio）
 * - 平台列表：user-data/ai-providers.json（每个平台有 Base URL / API Key / 启用开关 / 模型列表）
 * - 默认模型分配：user-data/ai-model-assign.json（chat / deep / agent / plugin 四个用途）
 * - 兼容旧版单配置 user-data/ai-settings.json（无平台配置时回退）
 */
@Injectable()
export class AiSettingsService {
  private readonly dataDir: string;
  private readonly providersFile: string;
  private readonly assignFile: string;
  private readonly settingsFile: string;

  constructor() {
    this.dataDir =
      process.env.STORAGE_DATA_DIR || path.join(process.cwd(), 'user-data');
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.providersFile = path.join(this.dataDir, 'ai-providers.json');
    this.assignFile = path.join(this.dataDir, 'ai-model-assign.json');
    this.settingsFile = path.join(this.dataDir, 'ai-settings.json');
  }

  // ===== 平台（Provider）管理 =====

  listProviders(): AiProvider[] {
    if (!fs.existsSync(this.providersFile)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(this.providersFile, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  getProvider(id: string): AiProvider | undefined {
    return this.listProviders().find((p) => p.id === id);
  }

  private saveProviders(list: AiProvider[]): void {
    fs.writeFileSync(this.providersFile, JSON.stringify(list, null, 2), 'utf-8');
  }

  /** 新建 / 更新平台；apiKey 传空表示保留原 Key */
  saveProvider(input: {
    id?: string;
    name: string;
    baseUrl: string;
    apiKey?: string;
    enabled?: boolean;
  }): AiProvider {
    const list = this.listProviders();
    const now = new Date().toISOString();
    if (input.id) {
      const idx = list.findIndex((p) => p.id === input.id);
      if (idx >= 0) {
        const current = list[idx];
        const next: AiProvider = {
          ...current,
          name: input.name || current.name,
          baseUrl: input.baseUrl || current.baseUrl,
          apiKey:
            input.apiKey !== undefined && input.apiKey !== ''
              ? input.apiKey
              : current.apiKey,
          enabled: input.enabled ?? current.enabled,
          updatedAt: now,
        };
        list[idx] = next;
        this.saveProviders(list);
        return next;
      }
    }
    const provider: AiProvider = {
      id: `prov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: input.name,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey || '',
      enabled: input.enabled ?? false,
      models: [],
      createdAt: now,
      updatedAt: now,
    };
    list.push(provider);
    this.saveProviders(list);
    return provider;
  }

  deleteProvider(id: string): { success: boolean } {
    const list = this.listProviders();
    const next = list.filter((p) => p.id !== id);
    if (next.length === list.length) return { success: false };
    this.saveProviders(next);
    // 清理分配中引用该平台的选择
    const assign = this.getAssignments();
    let changed = false;
    for (const key of Object.keys(assign) as AiUsageKey[]) {
      if (assign[key]?.startsWith(`${id}:`)) {
        delete assign[key];
        changed = true;
      }
    }
    if (changed) this.saveAssignments(assign);
    return { success: true };
  }

  /** 从平台拉取模型列表并合并进 provider.models（新增默认启用，旧模型保留其启用状态） */
  async fetchModelsFromProvider(id: string): Promise<{ added: AiModelDef[]; total: number }> {
    const provider = this.getProvider(id);
    if (!provider) throw new Error('平台不存在');
    if (!provider.apiKey) throw new Error('该平台未配置 API Key');
    const modelsUrl = this.baseToModelsUrl(provider.baseUrl);
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${provider.apiKey}` },
    });
    if (response.status === 401) throw new Error('API Key 无效（401），请检查 Key');
    if (!response.ok) {
      const text = (await response.text()).slice(0, 300);
      throw new Error(`获取模型列表失败（${response.status}）：${text || '未知错误'}`);
    }
    const data = (await response.json()) as { data?: { id?: string }[] };
    const ids = (data?.data ?? []).map((m) => m.id).filter((x): x is string => !!x);
    if (ids.length === 0) throw new Error('该平台未返回任何模型（data 为空）');

    const list = this.listProviders();
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error('平台不存在');
    const existing = new Map(list[idx].models.map((m) => [m.id, m]));
    const added: AiModelDef[] = [];
    for (const modelId of ids) {
      if (!existing.has(modelId)) {
        const def: AiModelDef = { id: modelId, name: modelId, enabled: true };
        existing.set(modelId, def);
        added.push(def);
      }
    }
    list[idx] = {
      ...list[idx],
      models: [...existing.values()],
      updatedAt: new Date().toISOString(),
    };
    this.saveProviders(list);
    return { added, total: list[idx].models.length };
  }

  /** 手动添加模型 */
  addModel(
    providerId: string,
    input: { id: string; name?: string; contextLength?: number; enabled?: boolean },
  ): AiModelDef {
    const list = this.listProviders();
    const idx = list.findIndex((p) => p.id === providerId);
    if (idx < 0) throw new Error('平台不存在');
    const existing = list[idx].models.find((m) => m.id === input.id);
    if (existing) throw new Error('该模型已存在，请直接编辑');
    const def: AiModelDef = {
      id: input.id,
      name: input.name || input.id,
      contextLength: input.contextLength,
      enabled: input.enabled ?? true,
    };
    list[idx] = {
      ...list[idx],
      models: [...list[idx].models, def],
      updatedAt: new Date().toISOString(),
    };
    this.saveProviders(list);
    return def;
  }

  /** 更新模型（启用开关 / 展示名 / 上下文） */
  updateModel(
    providerId: string,
    modelId: string,
    patch: Partial<Pick<AiModelDef, 'name' | 'enabled' | 'contextLength'>>,
  ): AiModelDef {
    const list = this.listProviders();
    const idx = list.findIndex((p) => p.id === providerId);
    if (idx < 0) throw new Error('平台不存在');
    const midx = list[idx].models.findIndex((m) => m.id === modelId);
    if (midx < 0) throw new Error('模型不存在');
    const current = list[idx].models[midx];
    const next: AiModelDef = {
      ...current,
      name: patch.name !== undefined ? patch.name : current.name,
      enabled: patch.enabled !== undefined ? patch.enabled : current.enabled,
      contextLength:
        patch.contextLength !== undefined ? patch.contextLength : current.contextLength,
    };
    list[idx].models[midx] = next;
    list[idx].updatedAt = new Date().toISOString();
    this.saveProviders(list);
    return next;
  }

  deleteModel(providerId: string, modelId: string): { success: boolean } {
    const list = this.listProviders();
    const idx = list.findIndex((p) => p.id === providerId);
    if (idx < 0) return { success: false };
    const before = list[idx].models.length;
    list[idx].models = list[idx].models.filter((m) => m.id !== modelId);
    if (list[idx].models.length === before) return { success: false };
    list[idx].updatedAt = new Date().toISOString();
    this.saveProviders(list);
    // 清理分配引用
    const assign = this.getAssignments();
    let changed = false;
    for (const key of Object.keys(assign) as AiUsageKey[]) {
      if (assign[key] === `${providerId}:${modelId}`) {
        delete assign[key];
        changed = true;
      }
    }
    if (changed) this.saveAssignments(assign);
    return { success: true };
  }

  // ===== 默认模型分配 =====

  getAssignments(): AiModelAssignments {
    if (!fs.existsSync(this.assignFile)) return {};
    try {
      const parsed = JSON.parse(fs.readFileSync(this.assignFile, 'utf-8'));
      const out: AiModelAssignments = {};
      for (const key of ['chat', 'deep', 'agent', 'plugin'] as AiUsageKey[]) {
        if (typeof parsed?.[key] === 'string' && parsed[key]) out[key] = parsed[key];
      }
      return out;
    } catch {
      return {};
    }
  }

  saveAssignments(assign: AiModelAssignments): AiModelAssignments {
    fs.writeFileSync(this.assignFile, JSON.stringify(assign, null, 2), 'utf-8');
    return assign;
  }

  /** 校验并保存分配：value 必须指向已启用平台的已启用模型 */
  saveAssignmentsValidated(assign: AiModelAssignments): { ok: boolean; message?: string; data?: AiModelAssignments } {
    const providers = this.listProviders();
    const clean: AiModelAssignments = {};
    for (const key of ['chat', 'deep', 'agent', 'plugin'] as AiUsageKey[]) {
      const value = assign[key];
      if (!value) continue;
      const [pid, mid] = value.split(':');
      const provider = providers.find((p) => p.id === pid && p.enabled);
      if (!provider || !provider.models.some((m) => m.id === mid && m.enabled)) {
        return { ok: false, message: `${USAGE_LABEL[key]} 选择的模型不可用，请重新选择` };
      }
      clean[key] = value;
    }
    this.saveAssignments(clean);
    return { ok: true, data: clean };
  }

  // ===== 旧版单配置（兼容） =====

  private readLegacy(): AiSettings {
    if (!fs.existsSync(this.settingsFile)) {
      return { apiKey: '', baseUrl: '', model: '' };
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(this.settingsFile, 'utf-8'));
      return {
        apiKey: typeof parsed?.apiKey === 'string' ? parsed.apiKey : '',
        baseUrl: typeof parsed?.baseUrl === 'string' ? parsed.baseUrl : '',
        model: typeof parsed?.model === 'string' ? parsed.model : '',
      };
    } catch {
      return { apiKey: '', baseUrl: '', model: '' };
    }
  }

  getSettings(): AiSettings {
    return this.readLegacy();
  }

  saveSettings(input: { apiKey?: string; baseUrl?: string; model?: string }): AiSettings {
    const current = this.readLegacy();
    const next: AiSettings = {
      apiKey:
        input.apiKey !== undefined && input.apiKey !== ''
          ? input.apiKey
          : current.apiKey,
      baseUrl:
        input.baseUrl !== undefined && input.baseUrl !== ''
          ? input.baseUrl
          : current.baseUrl,
      model:
        input.model !== undefined && input.model !== ''
          ? input.model
          : current.model,
    };
    fs.writeFileSync(this.settingsFile, JSON.stringify(next, null, 2), 'utf-8');
    return next;
  }

  getEffectiveConfig(): EffectiveAiConfig {
    const user = this.readLegacy();
    const envKey = process.env.LOCAL_AI_API_KEY || process.env.AI_API_KEY || '';
    const envBase = process.env.LOCAL_AI_BASE_URL || '';
    const envModel = process.env.LOCAL_AI_MODEL || '';

    if (user.apiKey) {
      return {
        apiKey: user.apiKey,
        baseUrl: user.baseUrl || envBase || DEFAULT_BASE_URL,
        model: user.model || envModel || DEFAULT_MODEL,
        source: 'user',
      };
    }
    if (envKey) {
      return {
        apiKey: envKey,
        baseUrl: envBase || DEFAULT_BASE_URL,
        model: envModel || DEFAULT_MODEL,
        source: 'env',
      };
    }
    return {
      apiKey: '',
      baseUrl: DEFAULT_BASE_URL,
      model: DEFAULT_MODEL,
      source: 'none',
    };
  }

  // ===== 模型解析（核心） =====

  /**
   * 解析某用途的生效模型配置：
   * 显式 modelKey（providerId:modelId）> 该用途的默认分配 > 第一个启用平台的第一个启用模型 > 旧版单配置/env
   */
  resolveChatConfig(
    usageOrKey: AiUsageKey | string = 'chat',
  ): ResolvedModelConfig {
    const explicit = typeof usageOrKey === 'string' && usageOrKey.includes(':')
      ? usageOrKey
      : undefined;
    const usage: AiUsageKey = (['chat', 'deep', 'agent', 'plugin'] as AiUsageKey[]).includes(
      usageOrKey as AiUsageKey,
    )
      ? (usageOrKey as AiUsageKey)
      : 'chat';

    // 1) 显式指定 providerId:modelId
    if (explicit) {
      const [pid, mid] = explicit.split(':');
      const provider = this.getProvider(pid);
      const model = provider?.models.find((m) => m.id === mid && m.enabled);
      if (provider && model && provider.apiKey) {
        return {
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
          model: mid,
          providerId: pid,
          providerName: provider.name,
          modelId: mid,
          usage,
          source: 'user',
        };
      }
    }

    // 2) 该用途默认分配
    const assignValue = this.getAssignments()[usage];
    if (assignValue) {
      const [pid, mid] = assignValue.split(':');
      const provider = this.getProvider(pid);
      const model = provider?.models.find((m) => m.id === mid && m.enabled);
      if (provider && model && provider.apiKey) {
        return {
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
          model: mid,
          providerId: pid,
          providerName: provider.name,
          modelId: mid,
          usage,
          source: 'user',
        };
      }
    }

    // 3) 第一个启用平台的第一个启用模型
    const enabledProvider = this.listProviders().find((p) => p.enabled && p.apiKey);
    const firstModel = enabledProvider?.models.find((m) => m.enabled);
    if (enabledProvider && firstModel) {
      return {
        apiKey: enabledProvider.apiKey,
        baseUrl: enabledProvider.baseUrl,
        model: firstModel.id,
        providerId: enabledProvider.id,
        providerName: enabledProvider.name,
        modelId: firstModel.id,
        usage,
        source: 'user',
      };
    }

    // 4) 回退旧版单配置
    const legacy = this.getEffectiveConfig();
    return { ...legacy, usage };
  }

  /** 测试平台连接（可指定模型；默认取该平台第一个启用模型） */
  async testProvider(
    providerId: string,
    modelId?: string,
  ): Promise<{ ok: boolean; message: string }> {
    const provider = this.getProvider(providerId);
    if (!provider) return { ok: false, message: '平台不存在' };
    if (!provider.apiKey) return { ok: false, message: '未配置 API Key' };
    const model =
      (modelId ? provider.models.find((m) => m.id === modelId) : undefined) ??
      provider.models.find((m) => m.enabled) ??
      provider.models[0];
    if (!model) return { ok: false, message: '该平台还没有模型，请先获取/添加模型' };
    try {
      const response = await fetch(this.normalizeBaseUrl(provider.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: model.id,
          messages: [{ role: 'user', content: '请只回复两个字：正常' }],
          max_tokens: 16,
          temperature: 0,
        }),
      });
      if (response.status === 401) {
        return { ok: false, message: 'API Key 无效（401），请检查 Key' };
      }
      if (!response.ok) {
        const text = (await response.text()).slice(0, 300);
        return { ok: false, message: `连接失败（${response.status}）：${text || '未知错误'}` };
      }
      return { ok: true, message: `连接成功（平台：${provider.name}，模型：${model.id}）` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `连接失败：${msg}` };
    }
  }

  /** 全部可用模型选项（前端下拉用） */
  getModelOptions(): { value: string; label: string; providerName: string; modelId: string }[] {
    const out: { value: string; label: string; providerName: string; modelId: string }[] = [];
    for (const p of this.listProviders()) {
      if (!p.enabled || !p.apiKey) continue;
      for (const m of p.models) {
        if (!m.enabled) continue;
        out.push({
          value: `${p.id}:${m.id}`,
          label: `${p.name} / ${m.name || m.id}`,
          providerName: p.name,
          modelId: m.id,
        });
      }
    }
    return out;
  }

  maskKey(key: string): string {
    if (!key) return '';
    if (key.length <= 8) return '****';
    return `${key.slice(0, 4)}****${key.slice(-4)}`;
  }

  /**
   * 归一化 OpenAI 兼容 Base URL 到 /chat/completions
   */
  normalizeBaseUrl(baseUrl: string): string {
    let url = baseUrl.trim();
    if (!url) return url;
    url = url.replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(url)) return url;
    if (/\/completions$/i.test(url)) return url;
    return `${url}/chat/completions`;
  }

  /** Base URL → /models 端点地址 */
  private baseToModelsUrl(baseUrl: string): string {
    let url = baseUrl.trim().replace(/\/+$/, '');
    url = url.replace(/\/chat\/completions$/i, '');
    url = url.replace(/\/completions$/i, '');
    return `${url}/models`;
  }
}

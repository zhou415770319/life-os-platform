import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

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

/**
 * AI 助手 API 配置存储（user-data/ai-settings.json）
 * 优先级：用户配置 > 环境变量（LOCAL_AI_API_KEY / LOCAL_AI_BASE_URL / LOCAL_AI_MODEL）> 默认值
 */
@Injectable()
export class AiSettingsService {
  private readonly filePath: string;

  constructor() {
    const dir =
      process.env.STORAGE_DATA_DIR || path.join(process.cwd(), 'user-data');
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, 'ai-settings.json');
  }

  private read(): AiSettings {
    if (!fs.existsSync(this.filePath)) {
      return { apiKey: '', baseUrl: '', model: '' };
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      return {
        apiKey: typeof parsed?.apiKey === 'string' ? parsed.apiKey : '',
        baseUrl: typeof parsed?.baseUrl === 'string' ? parsed.baseUrl : '',
        model: typeof parsed?.model === 'string' ? parsed.model : '',
      };
    } catch {
      return { apiKey: '', baseUrl: '', model: '' };
    }
  }

  /** 用户保存的原始配置（未脱敏） */
  getSettings(): AiSettings {
    return this.read();
  }

  /** 保存配置；apiKey 传空/省略表示保留原 Key（前端不回显明文） */
  saveSettings(input: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  }): AiSettings {
    const current = this.read();
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
    fs.writeFileSync(this.filePath, JSON.stringify(next, null, 2), 'utf-8');
    return next;
  }

  /** 当前生效配置：用户配置 > 环境变量 > 默认 */
  getEffectiveConfig(): EffectiveAiConfig {
    const user = this.read();
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

  maskKey(key: string): string {
    if (!key) return '';
    if (key.length <= 8) return '****';
    return `${key.slice(0, 4)}****${key.slice(-4)}`;
  }

  /**
   * 归一化 OpenAI 兼容 Base URL：
   * 用户常只填主机或 /v1（如 https://api.siliconflow.cn/v1），
   * 统一补全为 /chat/completions；已包含则原样返回。
   */
  normalizeBaseUrl(baseUrl: string): string {
    let url = baseUrl.trim();
    if (!url) return url;
    url = url.replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(url)) return url;
    // 兼容只填到 /completions 的情况
    if (/\/completions$/i.test(url)) return url;
    return `${url}/chat/completions`;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { AiSettingsService } from '../modules/ai-settings/ai-settings.service';

interface CapabilityCallResult {
  content?: string;
  [key: string]: unknown;
}

export interface TextGenerateOptions {
  /** 模型用途：chat(默认) / deep / agent / plugin；也可直接传 providerId:modelId */
  modelKey?: string;
  /** 覆盖温度 */
  temperature?: number;
  /** 覆盖最大 token */
  maxTokens?: number;
  /** 取消信号：调用方（如 AI 聊天）可中断底层模型请求 */
  signal?: AbortSignal;
}

/**
 * 本地模式 AI 能力服务（替代平台 CapabilityService）
 * 配置优先级：模型服务平台（仿 Cherry Studio，按用途分配默认模型）> 设置页旧单配置 > 环境变量 > 默认
 * 兼容 OpenAI Chat Completions 协议。
 */
@Injectable()
export class LocalCapabilityService {
  private readonly logger = new Logger(LocalCapabilityService.name);

  constructor(private readonly aiSettingsService: AiSettingsService) {}

  load(_name: string): {
    call: (method: string, params: Record<string, unknown>) => Promise<CapabilityCallResult>;
  } {
    return {
      call: async (
        method: string,
        params: Record<string, unknown>,
      ): Promise<CapabilityCallResult> => {
        if (method === 'textGenerate') {
          const content = await this.textGenerate(params, {
            modelKey: typeof params._model_usage === 'string' ? params._model_usage : undefined,
          });
          return { content };
        }
        throw new Error(`Unsupported capability method: ${method}`);
      },
    };
  }

  /**
   * 供插件云函数 ctx.llm 等调用的公开入口
   * @param params.system 系统提示词（可选）
   * @param params.prompt 用户问题（必填）
   * @param opts.modelKey 指定用途或 providerId:modelId；默认 'plugin'
   */
  async generateText(
    params: { system?: string; prompt: string },
    opts?: TextGenerateOptions,
  ): Promise<string> {
    return this.textGenerate(
      {
        system_context: params.system ?? '',
        user_question: params.prompt,
      },
      opts,
    );
  }

  private async textGenerate(
    params: Record<string, unknown>,
    opts?: TextGenerateOptions,
  ): Promise<string> {
    // 生效配置：按用途解析（平台分配 > 旧配置 > 环境变量 > 默认）
    const eff = this.aiSettingsService.resolveChatConfig(opts?.modelKey ?? 'chat');
    const apiKey = eff.apiKey;
    const baseUrl = this.aiSettingsService.normalizeBaseUrl(eff.baseUrl);
    const model = eff.model;
    const systemContext = String(params.system_context ?? '');
    const userQuestion = String(params.user_question ?? '');

    if (!apiKey) {
      throw new Error(
        '未配置 AI API Key。请到「系统设置 → AI 配置」配置模型服务平台与 API Key 后使用，或在 .env 中设置 LOCAL_AI_API_KEY。',
      );
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemContext },
          { role: 'user', content: userQuestion },
        ],
        temperature: opts?.temperature ?? 0.7,
        ...(opts?.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      }),
      signal: opts?.signal,
    });

    if (response.status === 401) {
      throw new Error('AI API Key 无效，请检查 Key 是否正确');
    }
    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Local AI call failed: ${response.status} ${errorText}`);
      throw new Error(`AI 服务调用失败（${response.status}）：${errorText || '未知错误'}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data?.choices?.[0]?.message?.content ?? '';
  }
}

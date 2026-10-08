import { Injectable, Logger } from '@nestjs/common';
import { AiSettingsService } from '../modules/ai-settings/ai-settings.service';

interface CapabilityCallResult {
  content?: string;
  [key: string]: unknown;
}

/**
 * 本地模式 AI 能力服务（替代平台 CapabilityService）
 * 配置优先级：设置页用户配置的 API Key > 环境变量（LOCAL_AI_API_KEY）> 提示配置
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
          const content = await this.textGenerate(params);
          return { content };
        }
        throw new Error(`Unsupported capability method: ${method}`);
      },
    };
  }

  private async textGenerate(params: Record<string, unknown>): Promise<string> {
    // 生效配置：用户配置 > 环境变量 > 默认
    const eff = this.aiSettingsService.getEffectiveConfig();
    const apiKey = eff.apiKey;
    const baseUrl = this.aiSettingsService.normalizeBaseUrl(eff.baseUrl);
    const model = eff.model;
    const systemContext = String(params.system_context ?? '');
    const userQuestion = String(params.user_question ?? '');

    if (!apiKey) {
      throw new Error(
        '未配置 AI API Key。请到「系统设置 → AI 配置」填写你自己的 API Key 后使用，或在 .env 中设置 LOCAL_AI_API_KEY。',
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
        temperature: 0.7,
      }),
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

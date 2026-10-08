import { Body, Controller, Get, Post } from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { AiSettingsService } from './ai-settings.service';
import type {
  AiSettingsView,
  SaveAiSettingsDto,
  TestAiSettingsResult,
} from '@shared/api.interface';

@NeedLogin()
@Controller('api/ai-settings')
export class AiSettingsController {
  constructor(private readonly settingsService: AiSettingsService) {}

  @Get()
  async getSettings(): Promise<AiSettingsView> {
    const user = this.settingsService.getSettings();
    const eff = this.settingsService.getEffectiveConfig();
    return {
      configured: !!user.apiKey,
      apiKeyMasked: this.settingsService.maskKey(user.apiKey),
      baseUrl: user.baseUrl || eff.baseUrl,
      model: user.model || eff.model,
      source: eff.source,
    };
  }

  @Post()
  async saveSettings(
    @Body() body: SaveAiSettingsDto,
  ): Promise<AiSettingsView> {
    const saved = this.settingsService.saveSettings({
      apiKey: body.apiKey,
      baseUrl: body.baseUrl,
      model: body.model,
    });
    const eff = this.settingsService.getEffectiveConfig();
    return {
      configured: !!saved.apiKey,
      apiKeyMasked: this.settingsService.maskKey(saved.apiKey),
      baseUrl: saved.baseUrl || eff.baseUrl,
      model: saved.model || eff.model,
      source: eff.source,
    };
  }

  @Post('test')
  async testSettings(): Promise<TestAiSettingsResult> {
    const eff = this.settingsService.getEffectiveConfig();
    if (!eff.apiKey) {
      return { ok: false, message: '未配置 API Key，请先填写并保存' };
    }
    try {
      const response = await fetch(this.settingsService.normalizeBaseUrl(eff.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${eff.apiKey}`,
        },
        body: JSON.stringify({
          model: eff.model,
          messages: [
            {
              role: 'user',
              content: '请只回复两个字：正常',
            },
          ],
          max_tokens: 16,
          temperature: 0,
        }),
      });
      if (response.status === 401) {
        return { ok: false, message: 'API Key 无效（401），请检查 Key 是否正确' };
      }
      if (!response.ok) {
        const text = (await response.text()).slice(0, 300);
        return { ok: false, message: `连接失败（${response.status}）：${text || '未知错误'}` };
      }
      return { ok: true, message: `连接成功（模型：${eff.model}）` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `连接失败：${msg}` };
    }
  }
}

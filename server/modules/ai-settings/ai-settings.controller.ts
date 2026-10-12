import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { AiSettingsService } from './ai-settings.service';
import type {
  AiModelAssignments,
  AiProvidersView,
  AiSettingsView,
  SaveAiProviderDto,
  SaveAiSettingsDto,
  TestAiProviderResult,
  TestAiSettingsResult,
} from '@shared/api.interface';

@NeedLogin()
@Controller('api/ai-settings')
export class AiSettingsController {
  constructor(private readonly settingsService: AiSettingsService) {}

  // ===== 旧版单配置（兼容） =====

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
  async saveSettings(@Body() body: SaveAiSettingsDto): Promise<AiSettingsView> {
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
          messages: [{ role: 'user', content: '请只回复两个字：正常' }],
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

  // ===== 多平台模型服务（仿 Cherry Studio） =====

  @Get('providers')
  async getProviders(): Promise<AiProvidersView> {
    const providers = this.settingsService.listProviders().map((p) => ({
      ...p,
      apiKeyMasked: this.settingsService.maskKey(p.apiKey),
      configured: !!p.apiKey,
    }));
    const legacy = this.settingsService.getEffectiveConfig();
    return {
      providers,
      assignments: this.settingsService.getAssignments(),
      legacy: {
        configured: !!this.settingsService.getSettings().apiKey,
        baseUrl: legacy.baseUrl,
        model: legacy.model,
        source: legacy.source,
      },
      modelOptions: this.settingsService.getModelOptions(),
    };
  }

  @Post('providers')
  async saveProvider(@Body() body: SaveAiProviderDto) {
    const saved = this.settingsService.saveProvider({
      id: body.id,
      name: body.name,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      enabled: body.enabled,
    });
    return {
      provider: {
        ...saved,
        apiKeyMasked: this.settingsService.maskKey(saved.apiKey),
        configured: !!saved.apiKey,
      },
    };
  }

  @Delete('providers/:id')
  async removeProvider(@Param('id') id: string) {
    return this.settingsService.deleteProvider(id);
  }

  @Post('providers/:id/test')
  async testProvider(
    @Param('id') id: string,
    @Body() body: { modelId?: string },
  ): Promise<TestAiProviderResult> {
    return this.settingsService.testProvider(id, body?.modelId);
  }

  @Post('providers/:id/models/fetch')
  async fetchModels(@Param('id') id: string) {
    try {
      const result = await this.settingsService.fetchModelsFromProvider(id);
      return { ok: true, added: result.added, total: result.total };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: msg };
    }
  }

  @Post('providers/:id/models')
  async addModel(
    @Param('id') id: string,
    @Body() body: { id: string; name?: string; contextLength?: number },
  ) {
    try {
      const model = this.settingsService.addModel(id, {
        id: body.id,
        name: body.name,
        contextLength: body.contextLength,
      });
      return { ok: true, model };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: msg };
    }
  }

  @Patch('providers/:id/models/:modelId')
  async updateModel(
    @Param('id') id: string,
    @Param('modelId') modelId: string,
    @Body() body: { name?: string; enabled?: boolean; contextLength?: number },
  ) {
    try {
      const model = this.settingsService.updateModel(id, modelId, {
        name: body.name,
        enabled: body.enabled,
        contextLength: body.contextLength,
      });
      return { ok: true, model };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: msg };
    }
  }

  @Delete('providers/:id/models/:modelId')
  async removeModel(@Param('id') id: string, @Param('modelId') modelId: string) {
    return this.settingsService.deleteModel(id, modelId);
  }

  @Put('assignments')
  async saveAssignments(@Body() body: AiModelAssignments) {
    return this.settingsService.saveAssignmentsValidated(body);
  }
}

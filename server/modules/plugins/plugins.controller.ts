import { Controller, Get, Post, Delete, Param, Body, Patch, Req } from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import { Roles } from '../auth/roles.decorator';
import { PluginsService } from './plugins.service';
import { UpdatePluginDtoClass } from './plugins.dto';
import { PluginMethodRegistry } from './plugin-method.registry';
import type {
  PluginConfig,
  ListResponse,
  AvailablePlugin,
  InstalledPlugin,
  UpdatePluginDto,
} from '@shared/api.interface';

@NeedLogin()
@Controller('api/plugins')
export class PluginsController {
  constructor(
    private readonly pluginsService: PluginsService,
    private readonly pluginMethodRegistry: PluginMethodRegistry,
  ) {}

  @Get('profile')
  async getProfile(
    @Req() req: any,
  ): Promise<{
    platformName: string;
    version: string;
    theme: string;
    plugins: PluginConfig[];
  }> {
    return this.pluginsService.getDshProfile(req.userContext?.userId);
  }

  @Get()
  async findAll(@Req() req: any): Promise<ListResponse<PluginConfig>> {
    return this.pluginsService.findAll(req.userContext?.userId);
  }

  @Get('available')
  async getAvailable(@Req() req: any): Promise<ListResponse<AvailablePlugin>> {
    return this.pluginsService.getAvailablePlugins(req.userContext?.userId);
  }

  @Get('installed')
  async getInstalled(@Req() req: any): Promise<ListResponse<InstalledPlugin>> {
    return this.pluginsService.getInstalledPlugins(req.userContext?.userId);
  }

  @Get('methods')
  getMethods() {
    const methods = this.pluginMethodRegistry.getAllMethods();
    return { methods, count: methods.length };
  }

  @Roles('admin')
  @Post('methods/:methodId/execute')
  async executeMethod(
    @Param('methodId') methodId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: any,
  ) {
    const userId = req.userContext?.userId || '';
    return this.pluginMethodRegistry.executeMethod(
      methodId,
      (body.args as Record<string, unknown>) || {},
      userId,
    );
  }

  // 装载/暂停/恢复/卸载均按「当前登录用户」隔离，普通用户可管理自己的装载（无需 admin）
  @Post('install/:pluginKey')
  async install(
    @Param('pluginKey') pluginKey: string,
    @Req() req: any,
  ): Promise<PluginConfig> {
    return this.pluginsService.installPlugin(pluginKey, req.userContext?.userId || '');
  }

  @Post('uninstall/:pluginKey')
  async uninstall(
    @Param('pluginKey') pluginKey: string,
    @Req() req: any,
  ): Promise<{ success: boolean }> {
    return this.pluginsService.uninstallPlugin(pluginKey, req.userContext?.userId || '');
  }

  @Post('suspend/:pluginKey')
  async suspend(
    @Param('pluginKey') pluginKey: string,
    @Req() req: any,
  ): Promise<PluginConfig> {
    return this.pluginsService.suspendPlugin(pluginKey, req.userContext?.userId || '');
  }

  @Post('resume/:pluginKey')
  async resume(
    @Param('pluginKey') pluginKey: string,
    @Req() req: any,
  ): Promise<PluginConfig> {
    return this.pluginsService.resumePlugin(pluginKey, req.userContext?.userId || '');
  }

  @Roles('admin')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePluginDtoClass,
  ): Promise<PluginConfig> {
    return this.pluginsService.update(id, dto as UpdatePluginDto);
  }
}


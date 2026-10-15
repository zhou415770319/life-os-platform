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
  async getProfile(): Promise<{
    platformName: string;
    version: string;
    theme: string;
    plugins: PluginConfig[];
  }> {
    return this.pluginsService.getDshProfile();
  }

  @Get()
  async findAll(): Promise<ListResponse<PluginConfig>> {
    return this.pluginsService.findAll();
  }

  @Get('available')
  async getAvailable(): Promise<ListResponse<AvailablePlugin>> {
    return this.pluginsService.getAvailablePlugins();
  }

  @Get('installed')
  async getInstalled(): Promise<ListResponse<InstalledPlugin>> {
    return this.pluginsService.getInstalledPlugins();
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

  @Roles('admin')
  @Post('install/:pluginKey')
  async install(
    @Param('pluginKey') pluginKey: string,
    @Req() req: any,
  ): Promise<PluginConfig> {
    return this.pluginsService.installPlugin(pluginKey, req.userContext?.userId || '');
  }

  @Roles('admin')
  @Post('uninstall/:pluginKey')
  async uninstall(
    @Param('pluginKey') pluginKey: string,
    @Req() req: any,
  ): Promise<{ success: boolean }> {
    return this.pluginsService.uninstallPlugin(pluginKey, req.userContext?.userId || '');
  }

  @Roles('admin')
  @Post('suspend/:pluginKey')
  async suspend(
    @Param('pluginKey') pluginKey: string,
    @Req() req: any,
  ): Promise<PluginConfig> {
    return this.pluginsService.suspendPlugin(pluginKey, req.userContext?.userId || '');
  }

  @Roles('admin')
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


import { Controller, Get, Post, Param, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MarketService } from './market.service';
import type { PluginConfig } from '@shared/api.interface';

@Controller('api/market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  /** 在线市场插件列表（含已安装状态） */
  @Get()
  list() {
    return this.marketService.listMarketPlugins();
  }

  /** 安装市场插件 */
  @Post('install/:pluginKey')
  install(@Param('pluginKey') pluginKey: string): Promise<PluginConfig> {
    return this.marketService.install(pluginKey);
  }

  /** 卸载市场插件（保留数据） */
  @Post('uninstall/:pluginKey')
  uninstall(@Param('pluginKey') pluginKey: string): Promise<{ success: boolean }> {
    return this.marketService.uninstall(pluginKey);
  }

  /** 更新市场插件 */
  @Post('update/:pluginKey')
  update(@Param('pluginKey') pluginKey: string): Promise<PluginConfig> {
    return this.marketService.update(pluginKey);
  }

  /** 插件文件服务（前端 PluginHost 动态加载入口 JS / manifest） */
  @Get('serve/:pluginKey/:file')
  async serve(
    @Param('pluginKey') pluginKey: string,
    @Param('file') file: string,
    @Res() res: Response,
  ): Promise<void> {
    const { content, ext } = await this.marketService.serveFile(pluginKey, file);
    res
      .type(ext === '.js' ? 'application/javascript; charset=utf-8' : 'application/json; charset=utf-8')
      .send(content);
  }

  /** 读取插件数据集合 */
  @Get('data/:pluginKey/:collection')
  getCollection(@Param('pluginKey') pluginKey: string, @Param('collection') collection: string) {
    return this.marketService.getCollection(pluginKey, collection);
  }

  /** 写插件数据集合（add / update / delete） */
  @Post('data/:pluginKey/:collection')
  mutate(
    @Param('pluginKey') pluginKey: string,
    @Param('collection') collection: string,
    @Body() body: { op?: string; data?: Record<string, unknown> },
  ) {
    return this.marketService.mutateCollection(pluginKey, collection, body?.op ?? '', body?.data ?? {});
  }
}

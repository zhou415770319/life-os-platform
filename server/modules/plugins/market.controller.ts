import { Controller, Get, Post, Param, Body, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Roles } from '../auth/roles.decorator';
import { MarketService } from './market.service';
import type { PluginConfig, MarketPluginItem } from '@shared/api.interface';

@Controller('api/market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  /** 在线市场插件列表（含当前用户的已安装状态）；?force=1 强制绕过 10 分钟缓存 */
  @Get()
  list(
    @Query('force') force?: string,
    @Req() req?: Request,
  ): Promise<{ items: MarketPluginItem[]; total: number }> {
    const { userContext } = (req ?? {}) as Request & {
      userContext?: { userId: string };
    };
    return this.marketService.listMarketPlugins(
      force === '1' || force === 'true',
      userContext?.userId,
    );
  }

  /** 安装市场插件（按当前登录用户装载，无需 admin） */
  @Post('install/:pluginKey')
  install(
    @Req() req: Request,
    @Param('pluginKey') pluginKey: string,
  ): Promise<PluginConfig> {
    const { userContext } = req as Request & { userContext: { userId: string } };
    return this.marketService.install(pluginKey, userContext.userId);
  }

  /** 卸载市场插件（移除当前用户装载；全局无人使用时清理代码文件，保留数据，无需 admin） */
  @Post('uninstall/:pluginKey')
  uninstall(
    @Req() req: Request,
    @Param('pluginKey') pluginKey: string,
  ): Promise<{ success: boolean }> {
    const { userContext } = req as Request & { userContext: { userId: string } };
    return this.marketService.uninstall(pluginKey, userContext.userId);
  }

  /** 更新市场插件（元数据与代码全局生效） */
  @Post('update/:pluginKey')
  update(
    @Req() req: Request,
    @Param('pluginKey') pluginKey: string,
  ): Promise<PluginConfig> {
    const { userContext } = req as Request & { userContext: { userId: string } };
    return this.marketService.update(pluginKey, userContext.userId);
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

  /** 写插件数据集合（add / update / delete，管理员） */
  @Roles('admin')
  @Post('data/:pluginKey/:collection')
  mutate(
    @Param('pluginKey') pluginKey: string,
    @Param('collection') collection: string,
    @Body() body: { op?: string; data?: Record<string, unknown> },
  ) {
    return this.marketService.mutateCollection(pluginKey, collection, body?.op ?? '', body?.data ?? {});
  }
}

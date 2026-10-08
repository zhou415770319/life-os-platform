import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReviewBoardService, BoardLevel } from './review-board.service';

@Controller('api/review-board')
export class ReviewBoardController {
  constructor(private readonly service: ReviewBoardService) {}

  private parseLevel(level: string): BoardLevel {
    if (level === 'daily' || level === 'weekly' || level === 'monthly') return level;
    throw new BadRequestException('level 必须是 daily/weekly/monthly');
  }

  private parseMode(mode: string): 'view' | 'edit' {
    if (mode === 'view' || mode === 'edit') return mode;
    throw new BadRequestException('mode 必须是 view/edit');
  }

  /** 获取面板视图（含归档快照 + 未归档子面板 + 统计） */
  @Get('view')
  getView(@Query('level') level: string, @Query('key') key: string) {
    return this.service.getBoardView(this.parseLevel(level), key);
  }

  /** 保存面板内容（daily 正文 / weekly、monthly 总结区） */
  @Post('panel')
  savePanel(
    @Body() dto: { level: string; key: string; content: string },
  ) {
    return this.service.savePanel(this.parseLevel(dto.level), dto.key, dto.content ?? '');
  }

  /** 勾选/取消任务（本机侧） */
  @Post('toggle')
  toggleItem(
    @Body() dto: { level: string; key: string; itemId: string; done: boolean },
  ) {
    return this.service.toggleItem(
      this.parseLevel(dto.level),
      dto.key,
      dto.itemId,
      !!dto.done,
    );
  }

  /** 手动归档 */
  @Post('archive')
  archive(@Body() dto: { level: string; key: string }) {
    return this.service.archive(this.parseLevel(dto.level), dto.key);
  }

  /** 自动归档兜底（打开页面时调用） */
  @Post('archive/auto')
  autoArchive() {
    return this.service.autoArchive();
  }

  // ===== 分享链接 =====

  @Post('shares')
  createShare(@Body() dto: { level: string; key: string; mode: string }) {
    return this.service.createShareLink(
      this.parseLevel(dto.level),
      dto.key,
      this.parseMode(dto.mode),
    );
  }

  @Get('shares')
  getShares() {
    return this.service.getShares();
  }

  @Delete('shares/:id')
  deleteShare(@Param('id') id: string) {
    return this.service.deleteShare(id);
  }

  /** 公开访问（view 只读 / edit 可勾选），无需登录 */
  @Get('share/:token')
  getPublicShare(@Param('token') token: string) {
    return this.service.getPublicShareData(token);
  }

  /** 公开写回（仅 edit token） */
  @Post('share/:token/items')
  updatePublicItem(
    @Param('token') token: string,
    @Body() dto: { itemId: string; done: boolean },
  ) {
    return this.service.updatePublicItem(token, dto.itemId, !!dto.done);
  }

  // ===== ShareOne 发布包 =====

  /** 生成自包含 HTML 发布包（可发到 ShareOne） */
  @Post('publish')
  exportPublish(@Body() dto: { level: string; key: string; mode: string }) {
    return this.service.exportPublishBundle(
      this.parseLevel(dto.level),
      dto.key,
      this.parseMode(dto.mode),
    );
  }

  /** 直接访问发布包文件（复制链接打开即预览，避免被 ViewModule catch-all 拦截成应用壳） */
  @Get('publish/:fileName')
  getPublishFile(@Param('fileName') fileName: string, @Res() res: Response) {
    const file = this.service.getPublishFile(fileName);
    res.setHeader('Content-Type', file.contentType);
    res.send(file.content);
  }

  @Get('publishes')
  getPublishes() {
    return this.service.getPublishes();
  }

  /** 批量删除发布记录（顺带清理孤儿文件） */
  @Delete('publishes')
  deletePublishes(@Body() dto: { ids: string[] }) {
    if (!Array.isArray(dto?.ids) || dto.ids.length === 0) {
      throw new BadRequestException('ids 不能为空');
    }
    return this.service.deletePublishes(dto.ids);
  }

  @Post('publishes/:id/share-url')
  setShareUrl(@Param('id') id: string, @Body() dto: { shareUrl: string }) {
    return this.service.setPublishShareUrl(id, dto.shareUrl);
  }
}

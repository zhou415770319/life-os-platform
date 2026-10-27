import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { XmPlayerService } from './xm-player.service';
import type {
  XmPlayerBrowseResult,
  XmPlayerConfig,
  XmPlayerRefreshResult,
  XmPlayerSchedule,
  XmPlayerStatusUpdate,
} from '@shared/api.interface';

@Controller('api/xm-player')
export class XmPlayerController {
  constructor(private readonly service: XmPlayerService) {}

  @Get('config')
  config(): XmPlayerConfig {
    return this.service.getConfig();
  }

  /** 弹出系统对话框选择 Excel 文件并保存为配置（备用通道） */
  @Post('pick-excel')
  pickExcel() {
    return this.service.pickExcel();
  }

  /** 浏览本地目录（前端自绘文件选择弹框用） */
  @Get('browse')
  browse(@Query('path') path?: string): XmPlayerBrowseResult {
    return this.service.browse(path);
  }

  /** 直接设置 Excel 文件路径 */
  @Post('config')
  setConfig(@Body() dto: { excelPath?: string }): XmPlayerConfig {
    return this.service.setExcelPath(dto?.excelPath ?? '');
  }

  @Post('open-folder')
  openFolder() {
    return this.service.openExcelFolder();
  }

  /** 读取当前 Excel 全量数据（合集+进度+日程） */
  @Get('data')
  getData(): XmPlayerRefreshResult {
    return this.service.getData();
  }

  /** 刷新：重读 Excel 并与上次快照对比（新增/移除/更新） */
  @Post('refresh')
  refresh(): XmPlayerRefreshResult {
    return this.service.refresh();
  }

  /** 更新合集状态并保存 Excel（保存后触发影刀 RPA 文件触发器） */
  @Post('status')
  updateStatus(@Body() dto: XmPlayerStatusUpdate) {
    return this.service.updateStatus(dto?.collectionId ?? '', dto?.status ?? '');
  }

  /** 播放/暂停/停止按钮（直接改状态写回 Excel，触发影刀） */
  @Post('play')
  play(@Body() dto: { collectionId?: string; action?: 'play' | 'pause' | 'stop' }) {
    return this.service.play(dto?.collectionId ?? '', dto?.action ?? 'play');
  }

  /** 新增或编辑合集 */
  @Post('collection')
  upsertCollection(@Body() dto: { id?: string; name?: string; url?: string; totalEpisodes?: number; note?: string }) {
    return this.service.upsertCollection({
      id: dto?.id ?? '',
      name: dto?.name ?? '',
      url: dto?.url ?? '',
      totalEpisodes: dto?.totalEpisodes,
      note: dto?.note ?? '',
    });
  }

  /** 删除合集 */
  @Delete('collection/:id')
  deleteCollection(@Param('id') id: string) {
    return this.service.deleteCollection(decodeURIComponent(id));
  }

  /** 手动触发一次日程检查（调试用） */
  @Post('debug/check-schedules')
  debugCheckSchedules() {
    return this.service.checkSchedulesAndTrigger();
  }

  /** 保存日程（写回 Excel「日程」工作表） */
  @Put('schedules')
  saveSchedules(@Body() dto: { schedules?: XmPlayerSchedule[] }) {
    return this.service.saveSchedules(dto?.schedules ?? []);
  }

  /** 下载示例 Excel */
  @Get('example')
  downloadExample(@Res() res: Response) {
    const buf = this.service.buildExample();
    const fileName = '喜马拉雅合集播放-示例.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buf);
  }
}

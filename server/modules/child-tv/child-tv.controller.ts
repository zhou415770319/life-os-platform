import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ChildTvService } from './child-tv.service';
import type {
  ChildTvAuthInfo,
  ChildTvBrowseResult,
  ChildTvCollection,
  ChildTvCollectionInput,
  ChildTvLogEntry,
  ChildTvResolveUrlResult,
  ChildTvRuntimeStatus,
  ChildTvSchedule,
  ChildTvScheduleInput,
  ChildTvSettings,
  ChildTvStatsEntry,
} from '@shared/api.interface';

@Controller('api/child-tv')
export class ChildTvController {
  constructor(private readonly childTvService: ChildTvService) {}

  // ===== 鉴权（家长登录） =====

  @Post('login')
  login(@Body() dto: { username?: string; password?: string }, @Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    return this.childTvService.login(dto?.username ?? '', dto?.password ?? '', ip);
  }

  @Get('me')
  me(@Req() req: Request): ChildTvAuthInfo {
    return this.childTvService.authInfo(req);
  }

  @Post('pin-check')
  pinCheck(@Body() dto: { pin?: string }) {
    return this.childTvService.checkPin(dto?.pin ?? '');
  }

  @Put('account')
  updateAccount(
    @Req() req: Request,
    @Body() dto: { password?: string; pin?: string | null },
  ) {
    return this.childTvService.updateAccount(req, dto ?? {});
  }

  // ===== 设置 =====

  @Get('settings')
  getSettings(): ChildTvSettings {
    return this.childTvService.readSettings();
  }

  @Put('settings')
  async updateSettings(
    @Body() dto: Partial<ChildTvSettings>,
  ): Promise<ChildTvSettings> {
    return this.childTvService.updateSettings(dto ?? {});
  }

  // ===== 合集 =====

  @Get('collections')
  getCollections(): ChildTvCollection[] {
    return this.childTvService.getCollections();
  }

  @Get('collections/:id')
  getCollection(@Param('id') id: string): ChildTvCollection {
    return this.childTvService.getCollection(id);
  }

  @Post('collections')
  createCollection(
    @Body() dto: ChildTvCollectionInput,
  ): ChildTvCollection {
    return this.childTvService.createCollection(dto);
  }

  @Put('collections/:id')
  updateCollection(
    @Param('id') id: string,
    @Body() dto: Partial<ChildTvCollectionInput>,
  ): ChildTvCollection {
    return this.childTvService.updateCollection(id, dto);
  }

  @Delete('collections/:id')
  deleteCollection(
    @Param('id') id: string,
    @Query('force') force?: string,
  ): { success: boolean; detachedSchedules?: string[] } {
    return this.childTvService.deleteCollection(id, force === 'true');
  }

  /** 解析 URL：直链 or 合集页提取视频地址 */
  @Post('resolve-url')
  async resolveUrl(
    @Body() dto: { url: string },
  ): Promise<ChildTvResolveUrlResult> {
    return this.childTvService.resolveCollectionUrl(dto?.url ?? '');
  }

  // ===== 时段 =====

  @Get('schedules')
  getSchedules(): ChildTvSchedule[] {
    return this.childTvService.getSchedules();
  }

  @Post('schedules')
  createSchedule(
    @Body() dto: ChildTvScheduleInput,
  ): ChildTvSchedule {
    return this.childTvService.createSchedule(dto);
  }

  @Put('schedules/:id')
  updateSchedule(
    @Param('id') id: string,
    @Body() dto: Partial<ChildTvScheduleInput>,
  ): ChildTvSchedule {
    return this.childTvService.updateSchedule(id, dto);
  }

  @Delete('schedules/:id')
  deleteSchedule(
    @Param('id') id: string,
  ): { success: boolean } {
    return this.childTvService.deleteSchedule(id);
  }

  // ===== 控制（家长） =====

  @Post('play')
  playNow(@Body() dto: { scheduleId: string }): Promise<ChildTvRuntimeStatus> {
    return this.childTvService.playNow(dto?.scheduleId ?? '');
  }

  @Post('stop')
  stop(): { success: boolean } {
    return this.childTvService.stopPlayback('家长手动停止');
  }

  // ===== 状态 =====

  @Get('status')
  status(): ChildTvRuntimeStatus {
    return this.childTvService.getRuntimeStatus();
  }

  /** 观看页免登录只读状态 */
  @Get('watch-status')
  watchStatus(): {
    playing: boolean;
    currentTitle: string;
    remainingMinutes: number | null;
    nextSchedule: { name: string; startLabel: string; startsInMinutes: number } | null;
    endsAt: string | null;
  } {
    return this.childTvService.getWatchStatus();
  }

  /** 使用说明文档（家长/儿童均可查看，免登录） */
  @Get('usage')
  usage(): { title: string; content: string } {
    return this.childTvService.getUsageDoc();
  }

  // ===== 浏览 / 日志 / 统计 =====

  @Get('browse')
  browse(@Query('path') path?: string): ChildTvBrowseResult {
    return this.childTvService.browse(path);
  }

  @Get('logs')
  logs(): ChildTvLogEntry[] {
    return this.childTvService.getLogs();
  }

  @Get('stats')
  stats(): ChildTvStatsEntry[] {
    return this.childTvService.getStats();
  }

  /** 打开本插件服务文件所在文件夹 */
  @Post('open-data-dir')
  openDataDir(): { success: boolean; dataDir: string } {
    return this.childTvService.openDataDir();
  }
}

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
  getSettings(@Req() req: Request): ChildTvSettings {
    this.childTvService.requireAuth(req);
    return this.childTvService.readSettings();
  }

  @Put('settings')
  async updateSettings(
    @Req() req: Request,
    @Body() dto: Partial<ChildTvSettings>,
  ): Promise<ChildTvSettings> {
    this.childTvService.requireAuth(req);
    return this.childTvService.updateSettings(dto ?? {});
  }

  // ===== 合集 =====

  @Get('collections')
  getCollections(@Req() req: Request): ChildTvCollection[] {
    this.childTvService.requireAuth(req);
    return this.childTvService.getCollections();
  }

  @Get('collections/:id')
  getCollection(@Req() req: Request, @Param('id') id: string): ChildTvCollection {
    this.childTvService.requireAuth(req);
    return this.childTvService.getCollection(id);
  }

  @Post('collections')
  createCollection(
    @Req() req: Request,
    @Body() dto: ChildTvCollectionInput,
  ): ChildTvCollection {
    this.childTvService.requireAuth(req);
    return this.childTvService.createCollection(dto);
  }

  @Put('collections/:id')
  updateCollection(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: Partial<ChildTvCollectionInput>,
  ): ChildTvCollection {
    this.childTvService.requireAuth(req);
    return this.childTvService.updateCollection(id, dto);
  }

  @Delete('collections/:id')
  deleteCollection(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('force') force?: string,
  ): { success: boolean; detachedSchedules?: string[] } {
    this.childTvService.requireAuth(req);
    return this.childTvService.deleteCollection(id, force === 'true');
  }

  /** 解析 URL：直链 or 合集页提取视频地址 */
  @Post('resolve-url')
  async resolveUrl(
    @Req() req: Request,
    @Body() dto: { url: string },
  ): Promise<ChildTvResolveUrlResult> {
    this.childTvService.requireAuth(req);
    return this.childTvService.resolveCollectionUrl(dto?.url ?? '');
  }

  // ===== 时段 =====

  @Get('schedules')
  getSchedules(@Req() req: Request): ChildTvSchedule[] {
    this.childTvService.requireAuth(req);
    return this.childTvService.getSchedules();
  }

  @Post('schedules')
  createSchedule(
    @Req() req: Request,
    @Body() dto: ChildTvScheduleInput,
  ): ChildTvSchedule {
    this.childTvService.requireAuth(req);
    return this.childTvService.createSchedule(dto);
  }

  @Put('schedules/:id')
  updateSchedule(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: Partial<ChildTvScheduleInput>,
  ): ChildTvSchedule {
    this.childTvService.requireAuth(req);
    return this.childTvService.updateSchedule(id, dto);
  }

  @Delete('schedules/:id')
  deleteSchedule(
    @Req() req: Request,
    @Param('id') id: string,
  ): { success: boolean } {
    this.childTvService.requireAuth(req);
    return this.childTvService.deleteSchedule(id);
  }

  // ===== 控制（家长） =====

  @Post('play')
  playNow(@Req() req: Request, @Body() dto: { scheduleId: string }): Promise<ChildTvRuntimeStatus> {
    this.childTvService.requireParent(req);
    return this.childTvService.playNow(dto?.scheduleId ?? '');
  }

  @Post('stop')
  stop(@Req() req: Request): { success: boolean } {
    this.childTvService.requireParent(req);
    return this.childTvService.stopPlayback('家长手动停止');
  }

  // ===== 状态 =====

  @Get('status')
  status(@Req() req: Request): ChildTvRuntimeStatus {
    this.childTvService.requireAuth(req);
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
  browse(@Req() req: Request, @Query('path') path?: string): ChildTvBrowseResult {
    this.childTvService.requireAuth(req);
    return this.childTvService.browse(path);
  }

  @Get('logs')
  logs(@Req() req: Request): ChildTvLogEntry[] {
    this.childTvService.requireAuth(req);
    return this.childTvService.getLogs();
  }

  @Get('stats')
  stats(@Req() req: Request): ChildTvStatsEntry[] {
    this.childTvService.requireAuth(req);
    return this.childTvService.getStats();
  }

  /** 打开本插件服务文件所在文件夹 */
  @Post('open-data-dir')
  openDataDir(@Req() req: Request): { success: boolean; dataDir: string } {
    this.childTvService.requireAuth(req);
    return this.childTvService.openDataDir();
  }
}

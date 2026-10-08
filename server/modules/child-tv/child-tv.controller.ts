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
  ChildTvLogEntry,
  ChildTvRuntimeStatus,
  ChildTvSchedule,
  ChildTvScheduleInput,
  ChildTvSettings,
  ChildTvStatsEntry,
} from '@shared/api.interface';

@Controller('api/child-tv')
export class ChildTvController {
  constructor(private readonly childTvService: ChildTvService) {}

  // ===== 鉴权 =====

  @Post('login')
  login(@Body() dto: { username?: string; password?: string }) {
    return this.childTvService.login(dto?.username ?? '', dto?.password ?? '');
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
    this.childTvService.requireAuth(req);
    return this.childTvService.updateAccount(dto ?? {});
  }

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

  // ===== 控制 =====

  @Post('play')
  playNow(@Req() req: Request, @Body() dto: { scheduleId: string }): Promise<ChildTvRuntimeStatus> {
    this.childTvService.requireAuth(req);
    return this.childTvService.playNow(dto?.scheduleId ?? '');
  }

  @Post('stop')
  stop(@Req() req: Request): { success: boolean } {
    this.childTvService.requireAuth(req);
    return this.childTvService.stopPlayback('家长手动停止');
  }

  @Post('lock')
  lock(@Req() req: Request, @Body() dto: { minutes?: number }): ChildTvRuntimeStatus {
    this.childTvService.requireAuth(req);
    const minutes = Number(dto?.minutes) || this.childTvService.readSettings().defaultLockMinutes;
    return this.childTvService.startLock(minutes, 'manual');
  }

  @Post('unlock')
  unlock(@Req() req: Request): ChildTvRuntimeStatus {
    this.childTvService.requireAuth(req);
    return this.childTvService.unlock();
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
    locked: boolean;
    endsAt: string | null;
  } {
    return this.childTvService.getWatchStatus();
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
}

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
  Sse,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { ChildTvService } from './child-tv.service';import type {
  ChildTvAccountInfo,
  ChildTvAuthInfo,
  ChildTvBrowseResult,
  ChildTvLogEntry,
  ChildTvRuntimeStatus,
  ChildTvSchedule,
  ChildTvScheduleInput,
  ChildTvSettings,
  ChildTvStatsEntry,
  ChildTvSyncState,
} from '@shared/api.interface';

@Controller('api/child-tv')
export class ChildTvController {
  constructor(private readonly childTvService: ChildTvService) {}

  // ===== 鉴权（家长/儿童多账号） =====

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
    return this.childTvService.updateAccount(req, dto ?? {});
  }

  // ===== 账号管理（家长） =====

  /** 家长创建儿童账号 */
  @Post('accounts')
  createAccount(
    @Req() req: Request,
    @Body() dto: { username?: string; password?: string; displayName?: string },
  ): ChildTvAccountInfo {
    this.childTvService.requireParent(req);
    return this.childTvService.createChildAccount({
      username: dto?.username ?? '',
      password: dto?.password ?? '',
      displayName: dto?.displayName,
    });
  }

  /** 家长列出全部账号（含锁定状态） */
  @Get('accounts')
  listAccounts(@Req() req: Request): ChildTvAccountInfo[] {
    this.childTvService.requireParent(req);
    return this.childTvService.listAccounts();
  }

  /** 家长为儿童账号生成/刷新绑定码 */
  @Post('accounts/:username/bind')
  bindAccount(
    @Req() req: Request,
    @Param('username') username: string,
  ): ChildTvAccountInfo {
    this.childTvService.requireParent(req);
    return this.childTvService.generateBindCode(username);
  }

  /** 家长删除儿童账号（保留播放统计等数据） */
  @Delete('accounts/:username')
  deleteAccount(
    @Req() req: Request,
    @Param('username') username: string,
  ): { success: boolean } {
    this.childTvService.requireParent(req);
    return this.childTvService.deleteChildAccount(username);
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

  // ===== 控制（家长；双机模式下自动下发儿童端） =====

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

  /** 锁定：带 username 锁定指定儿童账号；不带则锁定本机 */
  @Post('lock')
  lock(
    @Req() req: Request,
    @Body() dto: { username?: string; minutes?: number },
  ): ChildTvAccountInfo | ChildTvRuntimeStatus {
    this.childTvService.requireParent(req);
    if (dto?.username) {
      const minutes = Number(dto.minutes) || this.childTvService.readSettings().defaultLockMinutes;
      return this.childTvService.lockChildAccount(dto.username, minutes);
    }
    const minutes = Number(dto?.minutes) || this.childTvService.readSettings().defaultLockMinutes;
    return this.childTvService.startLock(minutes, 'manual');
  }

  /** 解锁：带 username 解锁指定儿童账号；不带则解锁本机 */
  @Post('unlock')
  unlock(
    @Req() req: Request,
    @Body() dto: { username?: string },
  ): ChildTvAccountInfo | ChildTvRuntimeStatus {
    this.childTvService.requireParent(req);
    if (dto?.username) {
      return this.childTvService.unlockChildAccount(dto.username);
    }
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

  // ===== 双机同步（儿童端受控模式） =====

  /** 儿童端轮询同步状态（校验 account + 绑定码） */
  @Get('sync/state')
  syncState(
    @Query('account') account?: string,
    @Query('bind') bind?: string,
  ): ChildTvSyncState {
    return this.childTvService.getSyncState(account ?? '', bind ?? '');
  }

  /** 儿童端 SSE 长连接：家长端状态变化实时推送 */
  @Sse('sync/stream')
  syncStream(
    @Query('account') account?: string,
    @Query('bind') bind?: string,
  ): Observable<{ data: string }> {
    return this.childTvService.streamSyncEvents(account ?? '', bind ?? '');
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

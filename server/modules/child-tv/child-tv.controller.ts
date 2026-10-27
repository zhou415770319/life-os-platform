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
  ChildTvBatchCreateResult,
  ChildTvBatchDeleteResult,
  ChildTvBatchPreviewResult,
  ChildTvBrowseResult,
  ChildTvCollection,
  ChildTvCollectionInput,
  ChildTvCollectionProgressInfo,
  ChildTvLogEntry,
  ChildTvResolveUrlResult,
  ChildTvRuntimeStatus,
  ChildTvScanResult,
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

  /** 批量创建合集：选择父文件夹，其下每个一级子文件夹自动生成一个合集（子文件夹内音视频为资源） */
  @Post('collections/batch-create')
  batchCreateCollections(@Body() dto: { folder?: string }): ChildTvBatchCreateResult {
    return this.childTvService.batchCreateCollectionsFromFolder(dto?.folder ?? '');
  }

  /** 批量创建前的预览：先扫描对比，返回将新建与跳过（已存在/无媒体）的明细，不写库 */
  @Post('collections/batch-preview')
  batchPreviewCollections(@Body() dto: { folder?: string }): ChildTvBatchPreviewResult {
    return this.childTvService.previewBatchCreateFromFolder(dto?.folder ?? '');
  }

  /** 批量删除合集：被时段引用时自动解绑 */
  @Post('collections/batch-delete')
  batchDeleteCollections(@Body() dto: { ids?: string[] }): ChildTvBatchDeleteResult {
    return this.childTvService.batchDeleteCollections(dto?.ids ?? []);
  }

  /** 解析 URL：直链 or 合集页提取视频地址；cookie 为平台解析所需登录态（可选，成功后自动保存复用） */
  @Post('resolve-url')
  async resolveUrl(
    @Body() dto: { url: string; cookie?: string },
  ): Promise<ChildTvResolveUrlResult> {
    return this.childTvService.resolveCollectionUrl(dto?.url ?? '', dto?.cookie);
  }

  // ===== 喜马拉雅 · 浏览器辅助解析 =====

  /** 生成浏览器辅助解析脚本（用户在已登录的喜马拉雅页面 Console 运行；baseUrl 为 life-os 前端地址） */
  @Get('ximalaya/script')
  getXimalayaScript(
    @Query('token') token: string,
    @Query('baseUrl') baseUrl: string,
  ): { script: string } {
    return this.childTvService.getXimalayaScript(token ?? '', baseUrl ?? '');
  }

  /** 脚本回传直链（no-cors form 提交，防滥用：一次性 token + 地址白名单校验） */
  @Post('ximalaya/collect')
  collectXimalaya(
    @Body() body: { token?: string; payload?: string },
  ): { ok: boolean; message: string } {
    return this.childTvService.collectXimalayaResults(body?.token ?? '', body?.payload ?? '');
  }

  /** 查询浏览器辅助解析结果（前端"我已运行脚本"后拉取，按原顺序返回） */
  @Get('ximalaya/pending')
  getXimalayaPending(
    @Query('token') token: string,
  ): { items: { title?: string; url: string }[]; failed: { id: string; title: string; err?: string }[] } {
    return this.childTvService.getXimalayaPendingResult(token ?? '');
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
  playNow(@Body() dto: { scheduleId?: string; collectionId?: string; entryIndex?: number }): Promise<ChildTvRuntimeStatus> {
    return this.childTvService.playNow(dto ?? {});
  }

  @Post('stop')
  stop(): Promise<{ success: boolean }> {
    return this.childTvService.stopPlayback('家长手动停止');
  }

  // ===== 状态 =====

  @Get('status')
  async status(): Promise<ChildTvRuntimeStatus> {
    return this.childTvService.getRuntimeStatus();
  }

  /** 合集播放进度列表（展示"上次播到第几集/位置"） */
  @Get('progress')
  getProgress(): ChildTvCollectionProgressInfo[] {
    return this.childTvService.getCollectionProgress();
  }

  /** 观看页免登录只读状态 */
  @Get('watch-status')
  async watchStatus(): Promise<{
    playing: boolean;
    currentTitle: string;
    remainingMinutes: number | null;
    nextSchedule: { name: string; startLabel: string; startsInMinutes: number } | null;
    endsAt: string | null;
  }> {
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

  /** 扫描文件夹：递归返回全部音视频文件（含 .xm），按文件名排序，供合集导入预览 */
  @Post('scan-folder')
  scanFolder(@Body('path') path: string): ChildTvScanResult {
    return this.childTvService.scanFolder(path);
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

import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import {
  ProjectManagerService,
  type ProjectManagerConfig,
} from './project-manager.service';

@Controller('api/project-manager')
export class ProjectManagerController {
  constructor(private readonly projectManagerService: ProjectManagerService) {}

  /** 聚合看板：项目列表 + 阶段进度 + 指令完成统计（云函数聚合层） */
  @Get('overview')
  getOverview() {
    return this.projectManagerService.getOverview();
  }

  /** 项目详情（含该项目的指令列表，按排序号） */
  @Get('projects/:recordId')
  getProject(@Param('recordId') recordId: string) {
    return this.projectManagerService.getProject(recordId);
  }

  /** 更新项目注意事项（写回飞书项目主表，Markdown 原文） */
  @Put('projects/:recordId/notes')
  updateNotes(@Param('recordId') recordId: string, @Body() body: { notes?: string }) {
    return this.projectManagerService.updateProjectNotes(recordId, body?.notes ?? '');
  }

  /** 重新执行指令：状态 → 待执行（支持失败/未执行/已完成重跑覆盖） */
  @Post('instructions/:recordId/rerun')
  rerunInstruction(@Param('recordId') recordId: string) {
    return this.projectManagerService.rerunInstruction(recordId);
  }

  /** 影刀领取指令：待执行 → 执行中（加锁防重复触发） */
  @Post('instructions/:recordId/claim')
  claimInstruction(@Param('recordId') recordId: string) {
    return this.projectManagerService.claimInstruction(recordId);
  }

  /** 影刀回填结果：执行中 → 完成 / 失败 */
  @Post('instructions/:recordId/report')
  reportInstruction(
    @Param('recordId') recordId: string,
    @Body()
    dto: { status: '完成' | '失败'; result?: string; error?: string; shadowTaskId?: string },
  ) {
    return this.projectManagerService.reportInstruction(recordId, dto);
  }

  /** 读取连接配置（脱敏：不返回 token 明文） */
  @Get('config')
  getConfig() {
    const cfg = this.projectManagerService.loadConfig();
    return {
      appToken: cfg.appToken ?? '',
      projectTableId: cfg.projectTableId ?? '',
      instructionTableId: cfg.instructionTableId ?? '',
      tableUrl: cfg.tableUrl ?? '',
      pollIntervalMin: cfg.pollIntervalMin ?? 5,
      baseUrl: cfg.baseUrl ?? '',
      hasApiToken: Boolean(cfg.apiToken),
      hasAppCredential: Boolean(cfg.appId && cfg.appSecret),
      updatedAt: cfg.updatedAt ?? '',
    };
  }

  /** 保存连接配置 */
  @Post('config')
  saveConfig(@Body() dto: Partial<ProjectManagerConfig>) {
    const saved = this.projectManagerService.saveConfig(dto ?? {});
    return {
      success: true,
      appToken: saved.appToken ?? '',
      projectTableId: saved.projectTableId ?? '',
      instructionTableId: saved.instructionTableId ?? '',
      tableUrl: saved.tableUrl ?? '',
      pollIntervalMin: saved.pollIntervalMin ?? 5,
      hasApiToken: Boolean(saved.apiToken),
      hasAppCredential: Boolean(saved.appId && saved.appSecret),
    };
  }

  /** 测试连接（可携带未保存的配置试连） */
  @Post('config/test')
  testConnection(@Body() dto?: Partial<ProjectManagerConfig>) {
    return this.projectManagerService.testConnection(dto);
  }
}

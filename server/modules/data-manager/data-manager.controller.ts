import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { NeedLogin } from '../../platform-local/need-login';
import type { Request, Response } from 'express';
import { DataManagerService } from './data-manager.service';
import type {
  DataBackupV2,
  DataImportResult,
  DataExportResult,
  ExportOptionsResult,
  BackupImportPayload,
} from '@shared/api.interface';

@NeedLogin()
@Controller('api/data-manager')
export class DataManagerController {
  constructor(private readonly dataManagerService: DataManagerService) {}

  /** 可导出选项（核心模块 + 已装载插件） */
  @Get('export/options')
  async getExportOptions(): Promise<ExportOptionsResult> {
    return this.dataManagerService.getExportOptions();
  }

  /** 按勾选范围导出（v2 格式：模块与插件分组） */
  @Post('export')
  async exportByScopes(
    @Body() body: { scopes?: string[] },
  ): Promise<DataBackupV2> {
    return this.dataManagerService.exportByScopes(body.scopes ?? []);
  }

  /** 按勾选范围导出并下载 */
  @Get('download')
  async downloadBackup(
    @Req() req: Request,
    @Res() res: Response,
    @Query('scopes') scopes?: string | string[],
  ): Promise<void> {
    const { userId } = req.userContext;
    const scopeList = scopes
      ? (Array.isArray(scopes) ? scopes : String(scopes).split(',')).filter(Boolean)
      : [];
    const { data, filename } =
      scopeList.length > 0
        ? await this.dataManagerService.generateBackupFileByScopes(scopeList)
        : await this.dataManagerService.generateBackupFile(userId);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(data);
  }

  /** 兼容旧版：全量导出（v1 平铺格式） */
  @Get('export')
  async exportData(@Req() req: Request): Promise<DataExportResult> {
    const { userId } = req.userContext;
    return this.dataManagerService.exportAllData(userId);
  }

  @Post('import')
  async importData(
    @Req() req: Request,
    @Body() data: BackupImportPayload,
  ): Promise<DataImportResult> {
    const { userId } = req.userContext;
    return this.dataManagerService.importData(userId, data);
  }
}

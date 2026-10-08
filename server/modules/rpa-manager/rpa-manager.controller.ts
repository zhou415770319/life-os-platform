import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as fs from 'fs';
import { RpaManagerService } from './rpa-manager.service';

/** multer 上传文件的最小类型（项目未引入 @types/multer） */
interface UploadedFileLike {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimetype: string;
}

@Controller('api/rpa-manager')
export class RpaManagerController {
  constructor(private readonly rpaManagerService: RpaManagerService) {}

  /** 上传 Excel 文件并解析内容 */
  @Post('read-excel')
  @UseInterceptors(FileInterceptor('file'))
  readExcel(@UploadedFile() file?: UploadedFileLike) {
    if (!file) {
      return { success: false, message: '未收到文件，请选择 .xlsx/.xls 文件' };
    }
    return this.rpaManagerService.readExcelFromBuffer(file.buffer, file.originalname);
  }

  /** 用修改后的数据重建并保存 Excel，直接写回本地库登记的原路径 */
  @Post('save-excel')
  saveExcel(
    @Body()
    dto: {
      path: string;
      sheets: { name: string; rows: (string | number | boolean | null)[][] }[];
    },
  ) {
    return this.rpaManagerService.saveExcel(dto);
  }

  /** 按路径登记导入（支持文件或文件夹路径） */
  @Post('import-by-path')
  importByPath(@Body() dto: { path?: string }) {
    return this.rpaManagerService.importByPath(dto?.path ?? '');
  }

  /** 弹出系统原生对话框选择 Excel 文件（返回绝对路径） */
  @Post('pick-file')
  async pickFile() {
    return this.rpaManagerService.pickFileWithDialog();
  }

  /** 弹出系统原生对话框选择文件夹（返回绝对路径） */
  @Post('pick-folder')
  async pickFolder() {
    return this.rpaManagerService.pickFolderWithDialog();
  }

  /** 读取本地库已登记的文件内容（从原路径读取） */
  @Post('read-saved')
  readSaved(@Body() dto: { path: string }) {
    return this.rpaManagerService.readSavedFile(dto?.path ?? '');
  }

  /** 列出本地文件库（登记过的文件） */
  @Get('files')
  listFiles() {
    return this.rpaManagerService.listFiles();
  }

  /** 下载本地库登记的文件 */
  @Get('download/:filePath')
  download(@Param('filePath') filePath: string, @Res() res: Response) {
    const p = this.rpaManagerService.getFilePath(filePath);
    const fileName = p.split(/[\\/]/).pop() ?? 'file.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    fs.createReadStream(p).pipe(res);
  }

  /** 从本地文件库移除记录（不删除原文件） */
  @Delete('files/:filePath')
  deleteFile(@Param('filePath') filePath: string) {
    return this.rpaManagerService.deleteFile(filePath);
  }

  /** 打开文件所在文件夹（系统文件管理器，并选中该文件） */
  @Post('open-folder')
  openFolder(@Body() dto: { path: string }) {
    return this.rpaManagerService.openFileFolder(dto?.path ?? '');
  }

  /** 打开本地文件库索引所在目录 */
  @Post('open-library-folder')
  openLibraryFolder() {
    return this.rpaManagerService.openLibraryFolder();
  }
}

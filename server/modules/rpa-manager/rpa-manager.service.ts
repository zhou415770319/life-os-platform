import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

export interface ExcelSheetData {
  name: string;
  /** 首行作为表头 */
  headers: ExcelCellValue[];
  /** 全部行（含表头行），单元格值 string | number | boolean | null */
  rows: ExcelCellValue[][];
}

export type ExcelCellValue = string | number | boolean | null;

/** 本地文件库记录：登记过的文件，保存时直接写回原路径 */
export interface RpaFileInfo {
  fileName: string;
  /** 文件绝对路径（本地库记录的主标识） */
  path: string;
  /** 文件所在文件夹（绝对路径） */
  directory: string;
  size: number;
  sheets: string[];
  updatedAt: string;
}

/** 老版本复制存储目录（迁移种子用） */
const LEGACY_DIR = path.resolve(process.cwd(), 'user-data', 'rpa-files');
/** 本地文件库索引文件：登记用户读取过的文件路径 */
const INDEX_FILE = path.resolve(process.cwd(), 'user-data', 'rpa-library-index.json');

const EXCEL_EXT = /\.(xlsx|xls)$/i;

function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[\\/:*?"<>|]/g, '_').trim();
  if (!base) throw new BadRequestException('文件名不能为空');
  return base.endsWith('.xlsx') || base.endsWith('.xls') ? base : `${base}.xlsx`;
}

/** 收集目录下（含子目录，深度≤3）的 Excel 文件 */
function collectExcelFiles(root: string, depth = 0): string[] {
  if (depth > 3) return [];
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const p = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectExcelFiles(p, depth + 1));
    } else if (EXCEL_EXT.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

@Injectable()
export class RpaManagerService {
  private readonly logger = new Logger(RpaManagerService.name);

  constructor() {
    // 迁移：老版本 user-data/rpa-files 下的文件自动登记进本地库
    this.migrateLegacyFiles();
  }

  private loadIndex(): RpaFileInfo[] {
    try {
      if (!fs.existsSync(INDEX_FILE)) return [];
      const raw = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
      return Array.isArray(raw?.files) ? raw.files : [];
    } catch (err) {
      this.logger.warn(`Load rpa index failed: ${String(err)}`);
      return [];
    }
  }

  private saveIndex(files: RpaFileInfo[]) {
    fs.mkdirSync(path.dirname(INDEX_FILE), { recursive: true });
    fs.writeFileSync(INDEX_FILE, JSON.stringify({ files }, null, 2), 'utf-8');
  }

  /** 按路径刷新记录的元信息（大小/工作表/更新时间）；文件已不存在则保留旧值 */
  private refreshRecord(rec: RpaFileInfo): RpaFileInfo {
    try {
      const stat = fs.statSync(rec.path);
      let sheets: string[] = [];
      try {
        const wb = XLSX.readFile(rec.path);
        sheets = wb.SheetNames;
      } catch {
        sheets = rec.sheets ?? [];
      }
      return { ...rec, size: stat.size, sheets, updatedAt: stat.mtime.toISOString() };
    } catch {
      return rec;
    }
  }

  /** 登记一个文件到本地库（重复路径刷新元信息），返回记录 */
  private registerFile(filePath: string): RpaFileInfo {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
      throw new NotFoundException(`文件不存在：${absPath}`);
    }
    if (!EXCEL_EXT.test(absPath)) {
      throw new BadRequestException(`不是 Excel 文件：${path.basename(absPath)}`);
    }
    const stat = fs.statSync(absPath);
    let sheets: string[] = [];
    try {
      const wb = XLSX.readFile(absPath);
      sheets = wb.SheetNames;
    } catch {
      throw new BadRequestException('无法解析该文件，请确认是有效的 Excel（.xlsx/.xls）文件');
    }
    const files = this.loadIndex();
    const idx = files.findIndex((f) => f.path === absPath);
    const rec: RpaFileInfo = {
      fileName: path.basename(absPath),
      path: absPath,
      directory: path.dirname(absPath),
      size: stat.size,
      sheets,
      updatedAt: stat.mtime.toISOString(),
    };
    if (idx >= 0) {
      files[idx] = rec;
    } else {
      files.unshift(rec);
    }
    this.saveIndex(files);
    return rec;
  }

  /** 老版本复制目录迁移：user-data/rpa-files 下的 Excel 自动登记进本地库 */
  private migrateLegacyFiles() {
    try {
      if (!fs.existsSync(LEGACY_DIR)) return;
      const files = fs.readdirSync(LEGACY_DIR).filter((f) => EXCEL_EXT.test(f));
      if (files.length === 0) return;
      const index = this.loadIndex();
      let changed = false;
      for (const f of files) {
        const absPath = path.join(LEGACY_DIR, f);
        if (index.some((r) => r.path === absPath)) continue;
        try {
          const stat = fs.statSync(absPath);
          const wb = XLSX.readFile(absPath);
          index.unshift({
            fileName: f,
            path: absPath,
            directory: LEGACY_DIR,
            size: stat.size,
            sheets: wb.SheetNames,
            updatedAt: stat.mtime.toISOString(),
          });
          changed = true;
        } catch {
          // 跳过无法解析的文件
        }
      }
      if (changed) this.saveIndex(index);
    } catch {
      // 迁移失败不阻塞启动
    }
  }

  /** 解析 Excel 文件 Buffer，返回各 sheet 的表头与全部行 */
  readExcelFromBuffer(buffer: Buffer, originalName: string): {
    fileName: string;
    sheets: ExcelSheetData[];
  } {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('上传的 Excel 文件为空');
    }
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch (err) {
      this.logger.error('Parse excel failed', String(err));
      throw new BadRequestException('无法解析该文件，请确认是有效的 Excel（.xlsx/.xls）文件');
    }

    const sheets: ExcelSheetData[] = wb.SheetNames.map((sheetName) => {
      const ws = wb.Sheets[sheetName];
      const aoa = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: null,
        raw: false,
        blankrows: false,
      }) as unknown[][];

      const rows: (string | number | boolean | null)[][] = aoa.map((row) =>
        row.map((cell) => {
          if (cell === null || cell === undefined) return null;
          if (typeof cell === 'number' || typeof cell === 'boolean') return cell;
          return String(cell);
        }),
      );
      const headers: ExcelCellValue[] = rows[0] ?? [];
      return { name: sheetName, headers, rows };
    });

    return { fileName: originalName, sheets };
  }

  /** 按路径登记导入：支持粘贴单个 Excel 文件路径或文件夹路径 */
  importByPath(inputPath: string): {
    imported: number;
    items: RpaFileInfo[];
    single?: { fileName: string; sheets: ExcelSheetData[] };
  } {
    if (!inputPath || !inputPath.trim()) {
      throw new BadRequestException('请输入文件或文件夹路径');
    }
    const absPath = path.resolve(inputPath.trim());
    if (!fs.existsSync(absPath)) {
      throw new NotFoundException(`路径不存在：${absPath}`);
    }
    const stat = fs.statSync(absPath);
    const targets: string[] = stat.isDirectory()
      ? collectExcelFiles(absPath)
      : [absPath];

    if (targets.length === 0) {
      throw new BadRequestException(
        stat.isDirectory()
          ? '该文件夹下没有找到 Excel（.xlsx/.xls）文件'
          : '请提供 Excel（.xlsx/.xls）文件路径',
      );
    }

    const items: RpaFileInfo[] = [];
    for (const t of targets) {
      try {
        items.push(this.registerFile(t));
      } catch (err) {
        this.logger.warn(`Register ${t} failed: ${String(err)}`);
      }
    }

    let single: { fileName: string; sheets: ExcelSheetData[] } | undefined;
    if (targets.length === 1 && items.length === 1) {
      const rec = items[0];
      single = { fileName: rec.fileName, sheets: this.readSavedFile(rec.path).sheets };
    }

    return { imported: items.length, items, single };
  }

  /** 读取本地库已登记的文件（从原路径读取） */
  readSavedFile(filePath: string): { fileName: string; sheets: ExcelSheetData[] } {
    const rec = this.requireRecord(filePath);
    if (!fs.existsSync(rec.path)) {
      throw new NotFoundException(`文件 ${rec.fileName} 不存在或已被移动`);
    }
    const buffer = fs.readFileSync(rec.path);
    return this.readExcelFromBuffer(buffer, rec.fileName);
  }

  /** 校验路径已登记进本地库，返回记录 */
  private requireRecord(filePath: string): RpaFileInfo {
    const absPath = path.resolve(filePath);
    const rec = this.loadIndex().find((f) => f.path === absPath);
    if (!rec) {
      throw new NotFoundException('该文件未登记到本地文件库，请先通过「按路径导入」登记');
    }
    return rec;
  }

  /** 保存修改：直接写回本地库登记的原文件路径（不复制副本） */
  saveExcel(dto: {
    path: string;
    sheets: { name: string; rows: ExcelCellValue[][] }[];
  }): RpaFileInfo {
    if (!dto.path) throw new BadRequestException('缺少文件路径');
    const rec = this.requireRecord(dto.path);
    if (!Array.isArray(dto.sheets) || dto.sheets.length === 0) {
      throw new BadRequestException('缺少 sheet 数据');
    }

    const wb = XLSX.utils.book_new();
    for (const sheet of dto.sheets) {
      const cleanRows = (sheet.rows ?? []).map((row) =>
        (Array.isArray(row) ? row : []).map((cell) =>
          cell === null || cell === undefined ? '' : cell,
        ),
      );
      const ws = XLSX.utils.aoa_to_sheet(cleanRows);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31) || 'Sheet1');
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.mkdirSync(path.dirname(rec.path), { recursive: true });
    fs.writeFileSync(rec.path, buf);

    this.logger.log(`Overwrote excel file: ${rec.path} (${buf.length} bytes)`);

    const updated: RpaFileInfo = {
      ...rec,
      size: buf.length,
      sheets: dto.sheets.map((s) => s.name.slice(0, 31) || 'Sheet1'),
      updatedAt: new Date().toISOString(),
    };
    const files = this.loadIndex();
    const idx = files.findIndex((f) => f.path === rec.path);
    if (idx >= 0) files[idx] = updated;
    this.saveIndex(files);
    return updated;
  }

  /** 列出本地文件库（登记过的文件） */
  listFiles(): { items: RpaFileInfo[]; total: number } {
    const items = this.loadIndex()
      .map((rec) => this.refreshRecord(rec))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { items, total: items.length };
  }

  /** 从本地文件库移除记录（不删除原文件） */
  deleteFile(filePath: string): { success: boolean; fileName: string } {
    const absPath = path.resolve(filePath);
    const files = this.loadIndex();
    const idx = files.findIndex((f) => f.path === absPath);
    if (idx < 0) {
      throw new NotFoundException('该文件未登记到本地文件库');
    }
    const [removed] = files.splice(idx, 1);
    this.saveIndex(files);
    return { success: true, fileName: removed.fileName };
  }

  /** 获取本地库登记文件的下载路径 */
  getFilePath(filePath: string): string {
    return this.requireRecord(filePath).path;
  }

  /** 在系统文件管理器中打开文件所在文件夹（并选中该文件） */
  openFileFolder(filePath: string): { success: boolean; path: string } {
    const rec = this.requireRecord(filePath);
    if (!fs.existsSync(rec.path)) {
      throw new NotFoundException(`文件 ${rec.fileName} 不存在或已被移动`);
    }
    this.openInSystemExplorer(rec.path, true);
    return { success: true, path: rec.directory };
  }

  /** 在系统文件管理器中打开本地库索引所在目录 */
  openLibraryFolder(): { success: boolean; path: string } {
    fs.mkdirSync(path.dirname(INDEX_FILE), { recursive: true });
    this.openInSystemExplorer(path.dirname(INDEX_FILE), false);
    return { success: true, path: path.dirname(INDEX_FILE) };
  }

  /** 调用系统文件管理器打开目录或选中文件 */
  private openInSystemExplorer(target: string, selectFile: boolean): void {
    const winTarget = selectFile
      ? `explorer.exe /select,"${target}"`
      : `explorer.exe "${target}"`;
    const macTarget = selectFile
      ? `open -R "${target}"`
      : `open "${target}"`;
    const linuxTarget = `xdg-open "${selectFile ? path.dirname(target) : target}"`;
    const cmd =
      process.platform === 'win32'
        ? winTarget
        : process.platform === 'darwin'
          ? macTarget
          : linuxTarget;
    exec(cmd, (err) => {
      if (err) {
        this.logger.warn(`Open folder failed: ${err.message}`);
      }
    });
  }

  /** 弹出系统原生对话框选择 Excel 文件，返回绝对路径（取消返回空） */
  async pickFileWithDialog(): Promise<{ picked: boolean; path?: string }> {
    const script = [
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      'Add-Type -AssemblyName System.Windows.Forms',
      '$dlg = New-Object System.Windows.Forms.OpenFileDialog',
      '$dlg.Title = "选择 Excel 文件（RPA 管理）"',
      "$dlg.Filter = 'Excel 文件 (*.xlsx;*.xls)|*.xlsx;*.xls|所有文件 (*.*)|*.*'",
      '$dlg.Multiselect = $false',
      "if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dlg.FileName } else { Write-Output '' }",
    ].join('\r\n');
    const out = await this.runPowerShellScript(script);
    const p = out.trim();
    if (!p) return { picked: false };
    return { picked: true, path: p };
  }

  /** 弹出系统原生对话框选择文件夹，返回绝对路径（取消返回空） */
  async pickFolderWithDialog(): Promise<{ picked: boolean; path?: string }> {
    const script = [
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      'Add-Type -AssemblyName System.Windows.Forms',
      '$dlg = New-Object System.Windows.Forms.FolderBrowserDialog',
      '$dlg.Description = "选择包含 Excel 文件的文件夹（RPA 管理）"',
      '$dlg.ShowNewFolderButton = $false',
      "if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dlg.SelectedPath } else { Write-Output '' }",
    ].join('\r\n');
    const out = await this.runPowerShellScript(script);
    const p = out.trim();
    if (!p) return { picked: false };
    return { picked: true, path: p };
  }

  /** 异步执行 PowerShell 脚本（不阻塞事件循环），返回 stdout */
  private runPowerShellScript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const tmpFile = path.resolve(process.cwd(), 'user-data', '.rpa-pick-dialog.ps1');
      try {
        fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
        fs.writeFileSync(tmpFile, script, 'utf8');
      } catch (err) {
        reject(new BadRequestException('无法写入临时脚本'));
        return;
      }
      const cmd =
        process.platform === 'win32'
          ? `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`
          : process.platform === 'darwin'
            ? this.macDialogCommand('file')
            : `zenity --file-selection --title="选择 Excel 文件（RPA 管理）" --file-filter="*.xlsx *.xls"`;
      exec(cmd, { encoding: 'utf8', timeout: 300000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
        try {
          fs.unlinkSync(tmpFile);
        } catch {
          // 忽略清理失败
        }
        if (err) {
          // Linux 取消时 zenity 返回非零，视为未选择
          if (process.platform !== 'win32' && process.platform !== 'darwin') {
            resolve('');
            return;
          }
          reject(new BadRequestException('打开系统对话框失败'));
          return;
        }
        resolve(stdout);
      });
    });
  }

  /** macOS 暂用 osascript 打开面板（不常用路径） */
  private macDialogCommand(kind: 'file' | 'folder'): string {
    return kind === 'file'
      ? 'osascript -e "POSIX path of (choose file with prompt \\"选择 Excel 文件（RPA 管理）\\")"'
      : 'osascript -e "POSIX path of (choose folder with prompt \\"选择包含 Excel 文件的文件夹（RPA 管理）\\")"';
  }
}

import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  ReadExcelResult,
  RpaFileInfo,
  SaveExcelDto,
  ImportByPathResult,
  ExcelCellValue,
} from '@shared/api.interface';

export interface RpaSavedSheet {
  name: string;
  rows: ExcelCellValue[][];
}

/** 上传 Excel 文件并解析内容（浏览器选择，仅预览，不登记路径） */
export async function readExcelFile(file: File): Promise<ReadExcelResult> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axiosForBackend({
    url: '/api/rpa-manager/read-excel',
    method: 'POST',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return response.data;
}

/** 按路径登记导入（文件或文件夹路径），返回记录与解析结果 */
export async function importRpaByPath(path: string): Promise<ImportByPathResult> {
  const response = await axiosForBackend({
    url: '/api/rpa-manager/import-by-path',
    method: 'POST',
    data: { path },
    timeout: 60000,
  });
  return response.data;
}

/** 弹出系统原生对话框选择 Excel 文件（返回绝对路径） */
export async function pickRpaFile(): Promise<{ picked: boolean; path?: string }> {
  const response = await axiosForBackend({
    url: '/api/rpa-manager/pick-file',
    method: 'POST',
    timeout: 300000,
  });
  return response.data;
}

/** 弹出系统原生对话框选择文件夹（返回绝对路径） */
export async function pickRpaFolder(): Promise<{ picked: boolean; path?: string }> {
  const response = await axiosForBackend({
    url: '/api/rpa-manager/pick-folder',
    method: 'POST',
    timeout: 300000,
  });
  return response.data;
}

/** 读取本地库已登记的文件（从原路径读取） */
export async function readSavedExcel(filePath: string): Promise<ReadExcelResult> {
  const response = await axiosForBackend({
    url: '/api/rpa-manager/read-saved',
    method: 'POST',
    data: { path: filePath },
    timeout: 30000,
  });
  return response.data;
}

/** 保存修改：直接写回本地库登记的原文件路径 */
export async function saveExcelFile(dto: SaveExcelDto): Promise<RpaFileInfo> {
  const response = await axiosForBackend({
    url: '/api/rpa-manager/save-excel',
    method: 'POST',
    data: dto,
    timeout: 60000,
  });
  return response.data;
}

/** 列出本地文件库（登记过的文件） */
export async function listRpaFiles(): Promise<{ items: RpaFileInfo[]; total: number }> {
  const response = await axiosForBackend({
    url: '/api/rpa-manager/files',
    method: 'GET',
  });
  return response.data;
}

/** 从本地文件库移除记录（不删除原文件） */
export async function deleteRpaFile(filePath: string): Promise<{ success: boolean }> {
  const response = await axiosForBackend({
    url: `/api/rpa-manager/files/${encodeURIComponent(filePath)}`,
    method: 'DELETE',
  });
  return response.data;
}

/** 下载本地库登记的文件（走完整 API 域名，便于带 cookie） */
export function downloadRpaFile(filePath: string): void {
  const base =
    (window as unknown as { __API_BASE__?: string }).__API_BASE__ ??
    (window.location.origin.startsWith('http://localhost') ||
    window.location.origin.startsWith('http://127.0.0.1')
      ? 'http://localhost:3000'
      : window.location.origin);
  const url = `${base}/api/rpa-manager/download/${encodeURIComponent(filePath)}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** 在系统文件管理器中打开文件所在文件夹（并选中该文件） */
export async function openRpaFolder(filePath: string): Promise<{ success: boolean; path: string }> {
  const response = await axiosForBackend({
    url: '/api/rpa-manager/open-folder',
    method: 'POST',
    data: { path: filePath },
  });
  return response.data;
}

/** 打开本地文件库索引所在目录 */
export async function openRpaLibraryFolder(): Promise<{ success: boolean; path: string }> {
  const response = await axiosForBackend({
    url: '/api/rpa-manager/open-library-folder',
    method: 'POST',
  });
  return response.data;
}

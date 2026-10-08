import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  DataExportResult,
  DataImportResult,
  DataBackupV2,
  ExportOptionsResult,
  BackupImportPayload,
} from '@shared/api.interface';

export async function exportAllData(): Promise<DataExportResult> {
  const response = await axiosForBackend({
    url: '/api/data-manager/export',
    method: 'GET',
  });
  return response.data;
}

export async function getExportOptions(): Promise<ExportOptionsResult> {
  const response = await axiosForBackend({
    url: '/api/data-manager/export/options',
    method: 'GET',
  });
  return response.data;
}

export async function exportByScopes(scopes: string[]): Promise<DataBackupV2> {
  const response = await axiosForBackend({
    url: '/api/data-manager/export',
    method: 'POST',
    data: { scopes },
  });
  return response.data;
}

export async function downloadBackup(scopes?: string[]): Promise<Blob> {
  const query = scopes && scopes.length > 0 ? `?scopes=${scopes.map(encodeURIComponent).join(',')}` : '';
  const response = await axiosForBackend({
    url: `/api/data-manager/download${query}`,
    method: 'GET',
    responseType: 'blob',
  });
  return response.data;
}

export async function importData(data: BackupImportPayload): Promise<DataImportResult> {
  const response = await axiosForBackend({
    url: '/api/data-manager/import',
    method: 'POST',
    data,
  });
  return response.data;
}

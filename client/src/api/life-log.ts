import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  LifeLogEntry,
  LifeLogCategory,
  ListResponse,
} from '@shared/api.interface';

export async function getLifeLogEntries(params?: {
  eventType?: string;
  category?: LifeLogCategory | 'all';
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListResponse<LifeLogEntry>> {
  const query: Record<string, unknown> = {};
  if (params?.eventType) query.eventType = params.eventType;
  if (params?.category && params.category !== 'all')
    query.category = params.category;
  if (params?.startDate) query.startDate = params.startDate;
  if (params?.endDate) query.endDate = params.endDate;
  if (params?.page) query.page = params.page;
  if (params?.pageSize) query.pageSize = params.pageSize;

  const response = await axiosForBackend({
    url: '/api/life-log',
    method: 'GET',
    params: query,
  });
  return response.data;
}

export async function getLifeLogEntry(id: string): Promise<LifeLogEntry> {
  const response = await axiosForBackend({
    url: `/api/life-log/${id}`,
    method: 'GET',
  });
  return response.data;
}

export async function createLifeLogEntry(data: {
  eventType: string;
  eventCategory: LifeLogCategory;
  contentSummary: string;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<LifeLogEntry> {
  const response = await axiosForBackend({
    url: '/api/life-log',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function exportLifeLog(): Promise<LifeLogEntry[]> {
  const response = await axiosForBackend({
    url: '/api/life-log/export',
    method: 'GET',
  });
  return response.data;
}

export async function getLifeLogCategories(): Promise<
  { category: LifeLogCategory; count: number }[]
> {
  try {
    const response = await axiosForBackend({
      url: '/api/life-log/categories',
      method: 'GET',
    });
    return response.data;
  } catch (err) {
    logger.error('Fetch life log categories failed', { error: String(err) });
    return [];
  }
}

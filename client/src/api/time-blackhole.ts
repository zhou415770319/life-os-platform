import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export interface TimeBlackholeRecord {
  id: string;
  category: string;
  note: string;
  durationMinutes: number;
  recordDate: string;
  createdAt: string;
}

export interface TimeBlackholeStats {
  todayMinutes: number;
  todayCount: number;
  totalMinutes: number;
  byCategory: Record<string, number>;
}

export async function getRecords(recordDate?: string): Promise<TimeBlackholeRecord[]> {
  const query = recordDate ? `?recordDate=${recordDate}` : '';
  const response = await axiosForBackend({
    url: `/api/time-blackhole/records${query}`,
    method: 'GET',
  });
  return response.data;
}

export async function getStats(): Promise<TimeBlackholeStats> {
  const response = await axiosForBackend({
    url: '/api/time-blackhole/stats',
    method: 'GET',
  });
  return response.data;
}

export async function createRecord(dto: {
  category: string;
  note?: string;
  durationMinutes: number;
  recordDate?: string;
}): Promise<TimeBlackholeRecord> {
  const response = await axiosForBackend({
    url: '/api/time-blackhole/records',
    method: 'POST',
    data: dto,
  });
  return response.data;
}

export async function deleteRecord(id: string): Promise<void> {
  await axiosForBackend({
    url: `/api/time-blackhole/records/${id}`,
    method: 'DELETE',
  });
}

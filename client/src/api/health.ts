import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  HealthRecord,
  HealthRecordType,
  HealthSummary,
  ListResponse,
} from '@shared/api.interface';

export interface CreateHealthRecordDto {
  recordType: HealthRecordType;
  recordDate: string;
  metrics: {
    weight?: number;
    bodyFat?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    heartRate?: number;
    exerciseType?: string;
    durationMinutes?: number;
    intensity?: string;
    calories?: number;
    sleepHours?: number;
    sleepQuality?: number;
  };
  note?: string;
}

export type UpdateHealthRecordDto = Partial<CreateHealthRecordDto>;

export async function getHealthRecords(params?: {
  recordType?: HealthRecordType;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListResponse<HealthRecord>> {
  const response = await axiosForBackend({
    url: '/api/health/records',
    method: 'GET',
    params,
  });
  logger.info('[health] getRecords', { params });
  return response.data;
}

export async function getHealthRecord(id: string): Promise<HealthRecord> {
  const response = await axiosForBackend({
    url: `/api/health/records/${id}`,
    method: 'GET',
  });
  return response.data;
}

export async function createHealthRecord(
  data: CreateHealthRecordDto,
): Promise<HealthRecord> {
  const response = await axiosForBackend({
    url: '/api/health/records',
    method: 'POST',
    data,
  });
  logger.info('[health] createRecord');
  return response.data;
}

export async function updateHealthRecord(
  id: string,
  data: UpdateHealthRecordDto,
): Promise<HealthRecord> {
  const response = await axiosForBackend({
    url: `/api/health/records/${id}`,
    method: 'PATCH',
    data,
  });
  logger.info('[health] updateRecord', { id });
  return response.data;
}

export async function deleteHealthRecord(
  id: string,
): Promise<{ success: boolean }> {
  const response = await axiosForBackend({
    url: `/api/health/records/${id}`,
    method: 'DELETE',
  });
  logger.info('[health] deleteRecord', { id });
  return response.data;
}

export async function getHealthSummary(days = 7): Promise<HealthSummary> {
  const response = await axiosForBackend({
    url: '/api/health/summary',
    method: 'GET',
    params: { days },
  });
  logger.info('[health] getSummary', { days });
  return response.data;
}

import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export interface PomodoroRecord {
  id: string;
  taskName: string;
  durationMinutes: number;
  startedAt: string;
  completedAt: string;
  abandoned: boolean;
  taskId?: string;
}

export interface PomodoroStats {
  totalCount: number;
  totalMinutes: number;
  todayCount: number;
  todayMinutes: number;
  focusRate: number;
}

export async function getRecords(): Promise<PomodoroRecord[]> {
  const response = await axiosForBackend({
    url: '/api/pomodoro/records',
    method: 'GET',
  });
  return response.data;
}

export async function getStats(): Promise<PomodoroStats> {
  const response = await axiosForBackend({
    url: '/api/pomodoro/stats',
    method: 'GET',
  });
  return response.data;
}

export async function createRecord(dto: {
  taskName?: string;
  durationMinutes: number;
  completedAt: string;
  abandoned?: boolean;
  taskId?: string;
}): Promise<PomodoroRecord> {
  const response = await axiosForBackend({
    url: '/api/pomodoro/records',
    method: 'POST',
    data: dto,
  });
  return response.data;
}

export async function deleteRecord(id: string): Promise<void> {
  await axiosForBackend({ url: `/api/pomodoro/records/${id}`, method: 'DELETE' });
}

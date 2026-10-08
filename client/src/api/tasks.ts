import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  LifeTask,
  CreateTaskDto,
  UpdateTaskDto,
  TaskStatus,
  TaskPriority,
  TaskQuadrant,
  ListResponse,
} from '@shared/api.interface';

export interface TaskStatsSummary {
  statusStats: Record<TaskStatus, number>;
  quadrantStats: Record<TaskQuadrant, number>;
  todayCompleted: number;
  total: number;
}

export async function getTasks(params?: {
  status?: TaskStatus;
  priority?: TaskPriority;
  quadrant?: TaskQuadrant;
  project?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListResponse<LifeTask>> {
  const response = await axiosForBackend({
    url: '/api/tasks',
    method: 'GET',
    params,
  });
  return response.data;
}

export async function getTask(id: string): Promise<LifeTask> {
  const response = await axiosForBackend({
    url: `/api/tasks/${id}`,
    method: 'GET',
  });
  return response.data;
}

export async function createTask(data: CreateTaskDto): Promise<LifeTask> {
  const response = await axiosForBackend({
    url: '/api/tasks',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function updateTask(
  id: string,
  data: UpdateTaskDto,
): Promise<LifeTask> {
  const response = await axiosForBackend({
    url: `/api/tasks/${id}`,
    method: 'PATCH',
    data,
  });
  return response.data;
}

export async function deleteTask(id: string): Promise<{ success: boolean }> {
  const response = await axiosForBackend({
    url: `/api/tasks/${id}`,
    method: 'DELETE',
  });
  return response.data;
}

export async function getTaskStats(): Promise<TaskStatsSummary> {
  const response = await axiosForBackend({
    url: '/api/tasks/stats/summary',
    method: 'GET',
  });
  return response.data;
}

export type TaskFocusStats = Record<string, { count: number; minutes: number }>;

export async function getTaskFocusStats(): Promise<TaskFocusStats> {
  const response = await axiosForBackend({
    url: '/api/tasks/focus-stats',
    method: 'GET',
  });
  return response.data;
}

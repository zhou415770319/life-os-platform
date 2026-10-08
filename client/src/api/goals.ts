import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { LifeGoal, CreateGoalDto, UpdateGoalDto, ListResponse } from '@shared/api.interface';

export async function getGoals(params?: { page?: number; pageSize?: number }): Promise<ListResponse<LifeGoal>> {
  const searchParams = new URLSearchParams();
  if (params?.page !== undefined) searchParams.set('page', String(params.page));
  if (params?.pageSize !== undefined) searchParams.set('pageSize', String(params.pageSize));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const response = await axiosForBackend({ url: `/api/goals${query}`, method: 'GET' });
  return response.data;
}

export async function getGoal(id: string): Promise<LifeGoal> {
  const response = await axiosForBackend({ url: `/api/goals/${id}`, method: 'GET' });
  return response.data;
}

export async function createGoal(dto: CreateGoalDto): Promise<LifeGoal> {
  const response = await axiosForBackend({
    url: '/api/goals',
    method: 'POST',
    data: dto,
  });
  return response.data;
}

export async function updateGoal(id: string, dto: UpdateGoalDto): Promise<LifeGoal> {
  const response = await axiosForBackend({
    url: `/api/goals/${id}`,
    method: 'PATCH',
    data: dto,
  });
  return response.data;
}

export async function deleteGoal(id: string): Promise<void> {
  await axiosForBackend({ url: `/api/goals/${id}`, method: 'DELETE' });
}

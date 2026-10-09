import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  LifeHabit,
  HabitRecord,
  EnergyRecord,
  CreateHabitDto,
  UpdateHabitDto,
  CreateEnergyDto,
  ListResponse,
} from '@shared/api.interface';

export async function getHabits(params?: { page?: number; pageSize?: number }): Promise<ListResponse<LifeHabit>> {
  const searchParams = new URLSearchParams();
  if (params?.page !== undefined) searchParams.set('page', String(params.page));
  if (params?.pageSize !== undefined) searchParams.set('pageSize', String(params.pageSize));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const response = await axiosForBackend({ url: `/api/habits${query}`, method: 'GET' });
  return response.data;
}

export async function createHabit(dto: CreateHabitDto): Promise<LifeHabit> {
  const response = await axiosForBackend({
    url: '/api/habits',
    method: 'POST',
    data: dto,
  });
  return response.data;
}

export async function deleteHabit(id: string): Promise<void> {
  await axiosForBackend({ url: `/api/habits/${id}`, method: 'DELETE' });
}

export async function updateHabit(id: string, dto: UpdateHabitDto): Promise<LifeHabit> {
  const response = await axiosForBackend({
    url: `/api/habits/${id}`,
    method: 'PATCH',
    data: dto,
  });
  return response.data;
}

export async function getHabitRecords(date: string): Promise<ListResponse<HabitRecord>> {
  const response = await axiosForBackend({
    url: `/api/habits/records?date=${date}`,
    method: 'GET',
  });
  return response.data;
}

export async function toggleHabitRecord(habitId: string, date: string): Promise<HabitRecord> {
  const response = await axiosForBackend({
    url: '/api/habits/records/toggle',
    method: 'POST',
    data: { habitId, date },
  });
  return response.data;
}

export async function getEnergyRecords(): Promise<ListResponse<EnergyRecord>> {
  const response = await axiosForBackend({ url: '/api/habits/energy', method: 'GET' });
  return response.data;
}

export async function createEnergyRecord(dto: CreateEnergyDto): Promise<EnergyRecord> {
  const response = await axiosForBackend({
    url: '/api/habits/energy',
    method: 'POST',
    data: dto,
  });
  return response.data;
}

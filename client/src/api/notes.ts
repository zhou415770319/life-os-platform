import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  LifeNote,
  LifePrinciple,
  QuickLink,
  CreateNoteDto,
  UpdateNoteDto,
  CreatePrincipleDto,
  CreateQuickLinkDto,
  ListResponse,
} from '@shared/api.interface';

export async function getNotes(params?: { page?: number; pageSize?: number }): Promise<ListResponse<LifeNote>> {
  const searchParams = new URLSearchParams();
  if (params?.page !== undefined) searchParams.set('page', String(params.page));
  if (params?.pageSize !== undefined) searchParams.set('pageSize', String(params.pageSize));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const response = await axiosForBackend({ url: `/api/notes${query}`, method: 'GET' });
  return response.data;
}

export async function createNote(dto: CreateNoteDto): Promise<LifeNote> {
  const response = await axiosForBackend({
    url: '/api/notes',
    method: 'POST',
    data: dto,
  });
  return response.data;
}

export async function updateNote(id: string, dto: UpdateNoteDto): Promise<LifeNote> {
  const response = await axiosForBackend({
    url: `/api/notes/${id}`,
    method: 'PATCH',
    data: dto,
  });
  return response.data;
}

export async function deleteNote(id: string): Promise<void> {
  await axiosForBackend({ url: `/api/notes/${id}`, method: 'DELETE' });
}

export async function getPrinciples(params?: { page?: number; pageSize?: number }): Promise<ListResponse<LifePrinciple>> {
  const searchParams = new URLSearchParams();
  if (params?.page !== undefined) searchParams.set('page', String(params.page));
  if (params?.pageSize !== undefined) searchParams.set('pageSize', String(params.pageSize));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const response = await axiosForBackend({ url: `/api/notes/principles${query}`, method: 'GET' });
  return response.data;
}

export async function createPrinciple(dto: CreatePrincipleDto): Promise<LifePrinciple> {
  const response = await axiosForBackend({
    url: '/api/notes/principles',
    method: 'POST',
    data: dto,
  });
  return response.data;
}

export async function deletePrinciple(id: string): Promise<void> {
  await axiosForBackend({ url: `/api/notes/principles/${id}`, method: 'DELETE' });
}

export async function getQuickLinks(params?: { page?: number; pageSize?: number }): Promise<ListResponse<QuickLink>> {
  const searchParams = new URLSearchParams();
  if (params?.page !== undefined) searchParams.set('page', String(params.page));
  if (params?.pageSize !== undefined) searchParams.set('pageSize', String(params.pageSize));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const response = await axiosForBackend({ url: `/api/notes/quick-links${query}`, method: 'GET' });
  return response.data;
}

export async function createQuickLink(dto: CreateQuickLinkDto): Promise<QuickLink> {
  const response = await axiosForBackend({
    url: '/api/notes/quick-links',
    method: 'POST',
    data: dto,
  });
  return response.data;
}

export async function deleteQuickLink(id: string): Promise<void> {
  await axiosForBackend({ url: `/api/notes/quick-links/${id}`, method: 'DELETE' });
}

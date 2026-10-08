import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  ChildResource,
  CreateChildResourceDto,
  UpdateChildResourceDto,
  ListResponse,
} from '@shared/api.interface';

export async function getChildResources(params?: {
  category?: string;
  search?: string;
  resourceType?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListResponse<ChildResource>> {
  const response = await axiosForBackend({
    url: '/api/child-resources',
    method: 'GET',
    params,
  });
  return response.data;
}

export async function getChildResource(id: string): Promise<ChildResource> {
  const response = await axiosForBackend({
    url: `/api/child-resources/${id}`,
    method: 'GET',
  });
  return response.data;
}

export async function createChildResource(
  data: CreateChildResourceDto,
): Promise<ChildResource> {
  const response = await axiosForBackend({
    url: '/api/child-resources',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function updateChildResource(
  id: string,
  data: UpdateChildResourceDto,
): Promise<ChildResource> {
  const response = await axiosForBackend({
    url: `/api/child-resources/${id}`,
    method: 'PATCH',
    data,
  });
  return response.data;
}

export async function deleteChildResource(
  id: string,
): Promise<{ success: boolean }> {
  const response = await axiosForBackend({
    url: `/api/child-resources/${id}`,
    method: 'DELETE',
  });
  return response.data;
}

export async function getChildResourceCategories(): Promise<{
  items: string[];
}> {
  const response = await axiosForBackend({
    url: '/api/child-resources/categories/list',
    method: 'GET',
  });
  return response.data;
}

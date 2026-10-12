import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  AiModelAssignments,
  AiProvidersView,
  AiSettingsView,
  SaveAiProviderDto,
  SaveAiSettingsDto,
  TestAiProviderResult,
  TestAiSettingsResult,
} from '@shared/api.interface';

// ===== 旧版单配置（兼容） =====

export async function getAiSettings(): Promise<AiSettingsView> {
  const response = await axiosForBackend({
    url: '/api/ai-settings',
    method: 'GET',
  });
  return response.data;
}

export async function saveAiSettings(
  data: SaveAiSettingsDto,
): Promise<AiSettingsView> {
  const response = await axiosForBackend({
    url: '/api/ai-settings',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function testAiSettings(): Promise<TestAiSettingsResult> {
  const response = await axiosForBackend({
    url: '/api/ai-settings/test',
    method: 'POST',
  });
  return response.data;
}

// ===== 多平台模型服务（仿 Cherry Studio） =====

export async function getProviders(): Promise<AiProvidersView> {
  const response = await axiosForBackend({
    url: '/api/ai-settings/providers',
    method: 'GET',
  });
  return response.data;
}

export async function saveProvider(data: SaveAiProviderDto): Promise<unknown> {
  const response = await axiosForBackend({
    url: '/api/ai-settings/providers',
    method: 'POST',
    data,
  });
  return response.data;
}

export async function deleteProvider(id: string): Promise<{ success: boolean }> {
  const response = await axiosForBackend({
    url: `/api/ai-settings/providers/${id}`,
    method: 'DELETE',
  });
  return response.data;
}

export async function testProvider(
  id: string,
  modelId?: string,
): Promise<TestAiProviderResult> {
  const response = await axiosForBackend({
    url: `/api/ai-settings/providers/${id}/test`,
    method: 'POST',
    data: modelId ? { modelId } : {},
  });
  return response.data;
}

export async function fetchModels(
  id: string,
): Promise<{ ok: boolean; message?: string; added?: unknown[]; total?: number }> {
  const response = await axiosForBackend({
    url: `/api/ai-settings/providers/${id}/models/fetch`,
    method: 'POST',
  });
  return response.data;
}

export async function addModel(
  id: string,
  data: { id: string; name?: string; contextLength?: number },
): Promise<{ ok: boolean; message?: string }> {
  const response = await axiosForBackend({
    url: `/api/ai-settings/providers/${id}/models`,
    method: 'POST',
    data,
  });
  return response.data;
}

export async function updateModel(
  id: string,
  modelId: string,
  data: { name?: string; enabled?: boolean; contextLength?: number },
): Promise<{ ok: boolean; message?: string }> {
  const response = await axiosForBackend({
    url: `/api/ai-settings/providers/${id}/models/${encodeURIComponent(modelId)}`,
    method: 'PATCH',
    data,
  });
  return response.data;
}

export async function removeModel(
  id: string,
  modelId: string,
): Promise<{ success: boolean }> {
  const response = await axiosForBackend({
    url: `/api/ai-settings/providers/${id}/models/${encodeURIComponent(modelId)}`,
    method: 'DELETE',
  });
  return response.data;
}

export async function saveAssignments(
  data: AiModelAssignments,
): Promise<{ ok: boolean; message?: string; data?: AiModelAssignments }> {
  const response = await axiosForBackend({
    url: '/api/ai-settings/assignments',
    method: 'PUT',
    data,
  });
  return response.data;
}

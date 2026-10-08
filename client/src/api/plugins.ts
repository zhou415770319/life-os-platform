import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { PluginConfig, UpdatePluginDto, ListResponse, AvailablePlugin, InstalledPlugin } from '@shared/api.interface';

export async function getPlugins(): Promise<ListResponse<PluginConfig>> {
  const response = await axiosForBackend({ url: '/api/plugins', method: 'GET' });
  return response.data;
}

export async function updatePlugin(id: string, dto: UpdatePluginDto): Promise<PluginConfig> {
  const response = await axiosForBackend({
    url: `/api/plugins/${id}`,
    method: 'PATCH',
    data: dto,
  });
  return response.data;
}

export async function getDshProfile(): Promise<{
  platformName: string;
  version: string;
  theme: string;
  plugins: PluginConfig[];
}> {
  const response = await axiosForBackend({ url: '/api/plugins/profile', method: 'GET' });
  return response.data;
}

export async function getAvailablePlugins(): Promise<ListResponse<AvailablePlugin>> {
  const response = await axiosForBackend({ url: '/api/plugins/available', method: 'GET' });
  return response.data;
}

export async function getInstalledPlugins(): Promise<ListResponse<InstalledPlugin>> {
  const response = await axiosForBackend({ url: '/api/plugins/installed', method: 'GET' });
  return response.data;
}

export async function installPlugin(pluginKey: string): Promise<PluginConfig> {
  const response = await axiosForBackend({
    url: `/api/plugins/install/${pluginKey}`,
    method: 'POST',
  });
  return response.data;
}

export async function uninstallPlugin(pluginKey: string): Promise<{ success: boolean }> {
  const response = await axiosForBackend({
    url: `/api/plugins/uninstall/${pluginKey}`,
    method: 'POST',
  });
  return response.data;
}

export async function suspendPlugin(pluginKey: string): Promise<{ success: boolean }> {
  const response = await axiosForBackend({
    url: `/api/plugins/suspend/${pluginKey}`,
    method: 'POST',
  });
  return response.data;
}

export async function resumePlugin(pluginKey: string): Promise<{ success: boolean }> {
  const response = await axiosForBackend({
    url: `/api/plugins/resume/${pluginKey}`,
    method: 'POST',
  });
  return response.data;
}

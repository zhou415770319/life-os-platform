import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  PluginConfig,
  MarketPluginItem,
} from '@shared/api.interface';

export async function getMarketPlugins(): Promise<{ items: MarketPluginItem[]; total: number }> {
  const response = await axiosForBackend({ url: '/api/market', method: 'GET' });
  return response.data;
}

export async function marketInstall(pluginKey: string): Promise<PluginConfig> {
  const response = await axiosForBackend({
    url: `/api/market/install/${pluginKey}`,
    method: 'POST',
  });
  return response.data;
}

export async function marketUninstall(pluginKey: string): Promise<{ success: boolean }> {
  const response = await axiosForBackend({
    url: `/api/market/uninstall/${pluginKey}`,
    method: 'POST',
  });
  return response.data;
}

export async function marketUpdate(pluginKey: string): Promise<PluginConfig> {
  const response = await axiosForBackend({
    url: `/api/market/update/${pluginKey}`,
    method: 'POST',
  });
  return response.data;
}

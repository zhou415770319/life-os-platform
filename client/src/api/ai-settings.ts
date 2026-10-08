import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  AiSettingsView,
  SaveAiSettingsDto,
  TestAiSettingsResult,
} from '@shared/api.interface';

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

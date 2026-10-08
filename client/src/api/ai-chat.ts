import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  AiChatRequest,
  AiChatResponse,
  AiChatSession,
  AiChatSessionMessage,
  PluginMethod,
  ListResponse,
} from '@shared/api.interface';

export type { AiMemoryItem } from '@shared/api.interface';
import type { AiMemoryItem } from '@shared/api.interface';

export interface DeepDataSnapshot {
  date: string;
  habits: string;
  todayCheckIns: number;
  pomodoro: string;
  timeWasted: string;
  goals: string;
  openTasks: string;
}

export async function getAvailableMethods(): Promise<ListResponse<PluginMethod>> {
  const response = await axiosForBackend({
    url: '/api/ai-chat/methods',
    method: 'GET',
  });
  return response.data;
}

export async function chat(body: AiChatRequest): Promise<AiChatResponse> {
  const response = await axiosForBackend({
    url: '/api/ai-chat/chat',
    method: 'POST',
    data: body,
  });
  return response.data;
}

export async function getDeepContext(): Promise<DeepDataSnapshot> {
  const response = await axiosForBackend({
    url: '/api/ai-chat/context',
    method: 'GET',
  });
  return response.data;
}

export async function getMemories(): Promise<ListResponse<AiMemoryItem>> {
  const response = await axiosForBackend({
    url: '/api/ai-chat/memory',
    method: 'GET',
  });
  return response.data;
}

export async function addMemory(
  content: string,
  category: AiMemoryItem['category'] = 'other',
): Promise<AiMemoryItem> {
  const response = await axiosForBackend({
    url: '/api/ai-chat/memory',
    method: 'POST',
    data: { content, category },
  });
  return response.data;
}

export async function deleteMemory(id: string): Promise<{ success: boolean }> {
  const response = await axiosForBackend({
    url: `/api/ai-chat/memory/${id}`,
    method: 'DELETE',
  });
  return response.data;
}

export async function getSessions(): Promise<ListResponse<AiChatSession>> {
  const response = await axiosForBackend({
    url: '/api/ai-chat/sessions',
    method: 'GET',
  });
  return response.data;
}

export async function getSessionMessages(sessionId: string): Promise<{ items: AiChatSessionMessage[] }> {
  const response = await axiosForBackend({
    url: `/api/ai-chat/sessions/${sessionId}`,
    method: 'GET',
  });
  return response.data;
}

export async function createSession(title?: string): Promise<AiChatSession> {
  const response = await axiosForBackend({
    url: '/api/ai-chat/sessions',
    method: 'POST',
    data: title ? { title } : {},
  });
  return response.data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await axiosForBackend({
    url: `/api/ai-chat/sessions/${sessionId}`,
    method: 'DELETE',
  });
}

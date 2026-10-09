import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  ChildTvAuthInfo,
  ChildTvBrowseResult,
  ChildTvLogEntry,
  ChildTvRuntimeStatus,
  ChildTvSchedule,
  ChildTvScheduleInput,
  ChildTvSettings,
  ChildTvStatsEntry,
} from '@shared/api.interface';

const TOKEN_KEY = 'child_tv_token';

export function getChildTvToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setChildTvToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(cfg: {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: unknown;
  params?: Record<string, unknown>;
}): Promise<T> {
  const token = getChildTvToken();
  const response = await axiosForBackend({
    url: cfg.url,
    method: cfg.method,
    data: cfg.data,
    params: cfg.params,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data as T;
}

/** 登录家长控制台，成功后保存 token */
export async function childTvLogin(username: string, password: string): Promise<void> {
  const res = await request<{ token: string; username: string }>({
    url: '/api/child-tv/login',
    method: 'POST',
    data: { username, password },
  });
  setChildTvToken(res.token);
}

export function childTvLogout(): void {
  setChildTvToken(null);
}

/** 当前鉴权状态 */
export async function childTvMe(): Promise<ChildTvAuthInfo> {
  try {
    return await request<ChildTvAuthInfo>({ url: '/api/child-tv/me', method: 'GET' });
  } catch {
    return { loggedIn: false, username: '', pinEnabled: false };
  }
}

export async function childTvCheckPin(pin: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>({
    url: '/api/child-tv/pin-check',
    method: 'POST',
    data: { pin },
  });
}

// ===== 时段 =====

export async function childTvListSchedules(): Promise<ChildTvSchedule[]> {
  return request<ChildTvSchedule[]>({ url: '/api/child-tv/schedules', method: 'GET' });
}

export async function childTvCreateSchedule(dto: ChildTvScheduleInput): Promise<ChildTvSchedule> {
  return request<ChildTvSchedule>({
    url: '/api/child-tv/schedules',
    method: 'POST',
    data: dto,
  });
}

export async function childTvUpdateSchedule(
  id: string,
  dto: Partial<ChildTvScheduleInput>,
): Promise<ChildTvSchedule> {
  return request<ChildTvSchedule>({
    url: `/api/child-tv/schedules/${id}`,
    method: 'PUT',
    data: dto,
  });
}

export async function childTvDeleteSchedule(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>({
    url: `/api/child-tv/schedules/${id}`,
    method: 'DELETE',
  });
}

// ===== 控制与状态 =====

export async function childTvPlay(scheduleId: string): Promise<ChildTvRuntimeStatus> {
  return request<ChildTvRuntimeStatus>({
    url: '/api/child-tv/play',
    method: 'POST',
    data: { scheduleId },
  });
}

export async function childTvStop(): Promise<{ success: boolean }> {
  return request<{ success: boolean }>({ url: '/api/child-tv/stop', method: 'POST' });
}

export async function childTvLock(minutes?: number): Promise<ChildTvRuntimeStatus> {
  return request<ChildTvRuntimeStatus>({
    url: '/api/child-tv/lock',
    method: 'POST',
    data: minutes ? { minutes } : {},
  });
}

export async function childTvUnlock(): Promise<ChildTvRuntimeStatus> {
  return request<ChildTvRuntimeStatus>({ url: '/api/child-tv/unlock', method: 'POST' });
}

export async function childTvStatus(): Promise<ChildTvRuntimeStatus> {
  return request<ChildTvRuntimeStatus>({ url: '/api/child-tv/status', method: 'GET' });
}

/** 观看页免登录状态 */
export async function childTvWatchStatus(): Promise<{
  playing: boolean;
  currentTitle: string;
  remainingMinutes: number | null;
  nextSchedule: { name: string; startLabel: string; startsInMinutes: number } | null;
  locked: boolean;
  endsAt: string | null;
  pinEnabled: boolean;
}> {
  return request({
    url: '/api/child-tv/watch-status',
    method: 'GET',
  });
}

// ===== 浏览 / 日志 / 统计 / 设置 =====

export async function childTvBrowse(path?: string): Promise<ChildTvBrowseResult> {
  return request<ChildTvBrowseResult>({
    url: '/api/child-tv/browse',
    method: 'GET',
    params: path ? { path } : {},
  });
}

export async function childTvLogs(): Promise<ChildTvLogEntry[]> {
  return request<ChildTvLogEntry[]>({ url: '/api/child-tv/logs', method: 'GET' });
}

export async function childTvStats(): Promise<ChildTvStatsEntry[]> {
  return request<ChildTvStatsEntry[]>({ url: '/api/child-tv/stats', method: 'GET' });
}

export async function childTvGetSettings(): Promise<ChildTvSettings> {
  return request<ChildTvSettings>({ url: '/api/child-tv/settings', method: 'GET' });
}

export async function childTvUpdateSettings(patch: Partial<ChildTvSettings>): Promise<ChildTvSettings> {
  return request<ChildTvSettings>({
    url: '/api/child-tv/settings',
    method: 'PUT',
    data: patch,
  });
}

export async function childTvUpdateAccount(dto: { password?: string; pin?: string | null }): Promise<{
  username: string;
  pinEnabled: boolean;
}> {
  return request({
    url: '/api/child-tv/account',
    method: 'PUT',
    data: dto,
  });
}

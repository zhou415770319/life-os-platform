import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  ChildTvAuthInfo,
  ChildTvBrowseResult,
  ChildTvCollection,
  ChildTvCollectionInput,
  ChildTvLogEntry,
  ChildTvResolveUrlResult,
  ChildTvRuntimeStatus,
  ChildTvSchedule,
  ChildTvScheduleInput,
  ChildTvSettings,
  ChildTvStatsEntry,
} from '@shared/api.interface';

const TOKEN_KEY = 'child_tv_token';
/** 登录失效事件：页面监听到后应清除本地状态并切回登录界面 */
export const CHILD_TV_UNAUTHORIZED_EVENT = 'life-os:child-tv-unauthorized';

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
  try {
    const response = await axiosForBackend({
      url: cfg.url,
      method: cfg.method,
      data: cfg.data,
      params: cfg.params,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return response.data as T;
  } catch (err) {
    // child-tv 独立认证：token 过期/无效时自动清理并通知页面（child-tv 的 401 不影响用户系统登录态）
    if ((err as { response?: { status?: number } })?.response?.status === 401) {
      setChildTvToken(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(CHILD_TV_UNAUTHORIZED_EVENT));
      }
    }
    throw err;
  }
}

/** 登录控制台（家长/儿童账号），成功后保存 token */
export async function childTvLogin(username: string, password: string): Promise<{
  token: string;
  username: string;
  role: 'parent' | 'child';
  displayName: string;
}> {
  const res = await request<{ token: string; username: string; role: 'parent' | 'child'; displayName: string }>({
    url: '/api/child-tv/login',
    method: 'POST',
    data: { username, password },
  });
  setChildTvToken(res.token);
  return res;
}

export function childTvLogout(): void {
  setChildTvToken(null);
}

/** 当前鉴权状态 */
export async function childTvMe(): Promise<ChildTvAuthInfo> {
  try {
    return await request<ChildTvAuthInfo>({ url: '/api/child-tv/me', method: 'GET' });
  } catch {
    return { loggedIn: false, username: '', role: null, displayName: '', pinEnabled: false };
  }
}

export async function childTvCheckPin(pin: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>({
    url: '/api/child-tv/pin-check',
    method: 'POST',
    data: { pin },
  });
}

// ===== 合集 =====

export async function childTvListCollections(): Promise<ChildTvCollection[]> {
  return request<ChildTvCollection[]>({ url: '/api/child-tv/collections', method: 'GET' });
}

export async function childTvCreateCollection(dto: ChildTvCollectionInput): Promise<ChildTvCollection> {
  return request<ChildTvCollection>({
    url: '/api/child-tv/collections',
    method: 'POST',
    data: dto,
  });
}

export async function childTvUpdateCollection(
  id: string,
  dto: Partial<ChildTvCollectionInput>,
): Promise<ChildTvCollection> {
  return request<ChildTvCollection>({
    url: `/api/child-tv/collections/${id}`,
    method: 'PUT',
    data: dto,
  });
}

export async function childTvDeleteCollection(
  id: string,
  force?: boolean,
): Promise<{ success: boolean; detachedSchedules?: string[] }> {
  return request<{ success: boolean; detachedSchedules?: string[] }>({
    url: `/api/child-tv/collections/${id}${force ? '?force=true' : ''}`,
    method: 'DELETE',
  });
}

/** 解析 URL：直链 or 合集页提取视频地址 */
export async function childTvResolveUrl(url: string): Promise<ChildTvResolveUrlResult> {
  return request<ChildTvResolveUrlResult>({
    url: '/api/child-tv/resolve-url',
    method: 'POST',
    data: { url },
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

export async function childTvStatus(): Promise<ChildTvRuntimeStatus> {
  return request<ChildTvRuntimeStatus>({ url: '/api/child-tv/status', method: 'GET' });
}

/** 观看页免登录状态 */
export async function childTvWatchStatus(): Promise<{
  playing: boolean;
  currentTitle: string;
  remainingMinutes: number | null;
  nextSchedule: { name: string; startLabel: string; startsInMinutes: number } | null;
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

/** 使用说明文档（家长/儿童均可查看，免登录） */
export async function childTvGetUsage(): Promise<{ title: string; content: string }> {
  return request<{ title: string; content: string }>({ url: '/api/child-tv/usage', method: 'GET' });
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

/** 打开本插件服务文件所在文件夹 */
export async function childTvOpenDataDir(): Promise<{ success: boolean; dataDir: string }> {
  return request<{ success: boolean; dataDir: string }>({
    url: '/api/child-tv/open-data-dir',
    method: 'POST',
  });
}

// ===== 插件云函数：系统文件/文件夹选择（后端能力，服务运行电脑弹出对话框） =====

export interface ChildTvPickResult {
  success: boolean;
  path?: string | null;
  canceled?: boolean;
  error?: string;
}

/** 弹出系统「选择文件」对话框，返回所选文件路径（依赖 child-tv 插件云函数已装载） */
export async function childTvPickFile(opts: {
  title?: string;
  filter?: string;
  initialPath?: string;
} = {}): Promise<ChildTvPickResult> {
  return request<ChildTvPickResult>({
    url: '/api/plugins/methods/dsh-plugin-child-tv.pickFilePath/execute',
    method: 'POST',
    data: { args: opts },
  });
}

/** 弹出系统「选择文件夹」对话框，返回所选文件夹路径（依赖 child-tv 插件云函数已装载） */
export async function childTvPickDirectory(opts: {
  title?: string;
  initialPath?: string;
} = {}): Promise<ChildTvPickResult> {
  return request<ChildTvPickResult>({
    url: '/api/plugins/methods/dsh-plugin-child-tv.pickDirectoryPath/execute',
    method: 'POST',
    data: { args: opts },
  });
}

/** 云函数目录浏览：列出盘符/子目录/文件（前端文件选择器数据源） */
export async function childTvListDirCloud(path?: string): Promise<ChildTvBrowseResult> {
  return request<ChildTvBrowseResult>({
    url: '/api/plugins/methods/dsh-plugin-child-tv.listDir/execute',
    method: 'POST',
    data: { args: path ? { path } : {} },
  });
}

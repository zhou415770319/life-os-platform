import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  XmPlayerBrowseResult,
  XmPlayerConfig,
  XmPlayerRefreshResult,
  XmPlayerSchedule,
  XmPlayerStatusUpdate,
} from '@shared/api.interface';

async function request<T>(cfg: {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: unknown;
}): Promise<T> {
  const response = await axiosForBackend({
    url: cfg.url,
    method: cfg.method,
    data: cfg.data,
  });
  return response.data as T;
}

/** 浏览本地目录（前端文件选择弹框用） */
export function xmPlayerBrowse(path?: string): Promise<XmPlayerBrowseResult> {
  return request<XmPlayerBrowseResult>({
    url: `/api/xm-player/browse${path ? `?path=${encodeURIComponent(path)}` : ''}`,
    method: 'GET',
  });
}

/** 当前配置 */
export function xmPlayerConfig(): Promise<XmPlayerConfig> {
  return request<XmPlayerConfig>({ url: '/api/xm-player/config', method: 'GET' });
}

/** 弹出系统对话框选择 Excel 文件 */
export function xmPlayerPickExcel(): Promise<{ picked: boolean; excelPath?: string }> {
  return request<{ picked: boolean; excelPath?: string }>({
    url: '/api/xm-player/pick-excel',
    method: 'POST',
  });
}

/** 直接设置 Excel 路径 */
export function xmPlayerSetExcelPath(excelPath: string): Promise<XmPlayerConfig> {
  return request<XmPlayerConfig>({ url: '/api/xm-player/config', method: 'POST', data: { excelPath } });
}

/** 打开 Excel 所在文件夹 */
export function xmPlayerOpenFolder(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>({ url: '/api/xm-player/open-folder', method: 'POST' });
}

/** 读取当前 Excel 全量数据 */
export function xmPlayerGetData(): Promise<XmPlayerRefreshResult> {
  return request<XmPlayerRefreshResult>({ url: '/api/xm-player/data', method: 'GET' });
}

/** 刷新（与快照对比增删） */
export function xmPlayerRefresh(): Promise<XmPlayerRefreshResult> {
  return request<XmPlayerRefreshResult>({ url: '/api/xm-player/refresh', method: 'POST' });
}

/** 更新合集状态（保存 Excel → 触发影刀文件触发器） */
export function xmPlayerUpdateStatus(dto: XmPlayerStatusUpdate): Promise<{ ok: boolean; message: string }> {
  return request<{ ok: boolean; message: string }>({
    url: '/api/xm-player/status',
    method: 'POST',
    data: dto,
  });
}

/** 播放/暂停/停止按钮（直接改状态写回 Excel，触发影刀） */
export function xmPlayerPlay(collectionId: string, action: 'play' | 'pause' | 'stop'): Promise<{ ok: boolean; message: string }> {
  return request<{ ok: boolean; message: string }>({
    url: '/api/xm-player/play',
    method: 'POST',
    data: { collectionId, action },
  });
}

/** 新增或编辑合集 */
export function xmPlayerUpsertCollection(dto: {
  id: string;
  name: string;
  url?: string;
  totalEpisodes?: number;
  note?: string;
}): Promise<{ ok: boolean; message: string }> {
  return request<{ ok: boolean; message: string }>({
    url: '/api/xm-player/collection',
    method: 'POST',
    data: dto,
  });
}

/** 删除合集 */
export function xmPlayerDeleteCollection(id: string): Promise<{ ok: boolean; message: string }> {
  return request<{ ok: boolean; message: string }>({
    url: `/api/xm-player/collection/${encodeURIComponent(id)}`,
    method: 'DELETE',
  });
}

/** 保存日程（写回 Excel 日程工作表） */
export function xmPlayerSaveSchedules(schedules: XmPlayerSchedule[]): Promise<{ ok: boolean; message: string }> {
  return request<{ ok: boolean; message: string }>({
    url: '/api/xm-player/schedules',
    method: 'PUT',
    data: { schedules },
  });
}

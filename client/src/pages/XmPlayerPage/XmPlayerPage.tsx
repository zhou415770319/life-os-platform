import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  RefreshCw,
  FolderOpen,
  FileSpreadsheet,
  Plus,
  Trash2,
  CalendarDays,
  ListMusic,
  Info,
  Save,
  Download,
  Radio,
  Folder,
  FolderUp,
  HardDrive,
  FileText,
  ChevronLeft,
  Play,
  Pause,
  Square,
  Edit2,
} from 'lucide-react';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import {
  xmPlayerBrowse,
  xmPlayerConfig,
  xmPlayerDeleteCollection,
  xmPlayerGetData,
  xmPlayerOpenFolder,
  xmPlayerPlay,
  xmPlayerRefresh,
  xmPlayerSaveSchedules,
  xmPlayerSetExcelPath,
  xmPlayerUpdateStatus,
  xmPlayerUpsertCollection,
} from '@client/src/api/xm-player';
import type { XmPlayerBrowseResult, XmPlayerCollection, XmPlayerRefreshResult, XmPlayerSchedule } from '@shared/api.interface';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import { extractApiError } from '@client/src/utils/api-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const STATUS_OPTIONS = ['未开始', '待播放', '播放中', '已暂停', '待停止', '已完成'];

const STATUS_STYLE: Record<string, string> = {
  未开始: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
  待播放: 'bg-sky-400/10 text-sky-300 border-sky-400/30',
  播放中: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
  已暂停: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
  待停止: 'bg-orange-400/10 text-orange-300 border-orange-400/30',
  已完成: 'bg-zinc-400/10 text-zinc-300 border-zinc-400/30',
};

interface ScheduleDraft {
  id: string;
  enabled: boolean;
  weekdays: string[];
  start: string;
  end: string;
  collectionId: string;
}

const EMPTY_DRAFT = (): ScheduleDraft => ({
  id: 's-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  enabled: true,
  weekdays: [],
  start: '20:00',
  end: '21:00',
  collectionId: '',
});

function fmtTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { hour12: false });
}

export default function XmPlayerPage() {
  const [tab, setTab] = useState<'collections' | 'schedules' | 'info'>('collections');
  const [excelPath, setExcelPath] = useState('');
  const [data, setData] = useState<XmPlayerRefreshResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [scheduleDrafts, setScheduleDrafts] = useState<XmPlayerSchedule[]>([]);
  const [draftForm, setDraftForm] = useState<ScheduleDraft | null>(null);
  const [saving, setSaving] = useState(false);
  // 文件选择弹框状态
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerData, setPickerData] = useState<XmPlayerBrowseResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [colEditorOpen, setColEditorOpen] = useState(false);
  const [colEditing, setColEditing] = useState<XmPlayerCollection | null>(null);
  const [colForm, setColForm] = useState({ id: '', name: '', url: '', totalEpisodes: '', note: '' });
  const [colSaving, setColSaving] = useState(false);

  const reload = useCallback(async (withRefresh: boolean) => {
    setLoading(true);
    try {
      const r = withRefresh ? await xmPlayerRefresh() : await xmPlayerGetData();
      setData(r);
      setExcelPath(r.excelPath);
      setScheduleDrafts(r.schedules);
      if (withRefresh && r.message) toast.success(r.message);
    } catch (e) {
      toast.error(extractApiError(e, '读取 Excel 失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const cfg = await xmPlayerConfig();
        if (cfg.excelPath) {
          setExcelPath(cfg.excelPath);
          await reload(false);
        }
      } catch {
        /* 未配置或未登录 */
      }
    })();
  }, [reload]);

  const openPicker = async (initial?: string) => {
    setPickerOpen(true);
    setSelectedFile(null);
    setPickerLoading(true);
    try {
      const target = initial ?? excelPath;
      const r = await xmPlayerBrowse(target || undefined);
      setPickerData(r);
    } catch (e) {
      toast.error(extractApiError(e, '读取目录失败'));
      setPickerData(null);
    } finally {
      setPickerLoading(false);
    }
  };

  const navigatePicker = async (path: string | null) => {
    setSelectedFile(null);
    setPickerLoading(true);
    try {
      const r = await xmPlayerBrowse(path ?? undefined);
      setPickerData(r);
    } catch (e) {
      toast.error(extractApiError(e, '读取目录失败'));
    } finally {
      setPickerLoading(false);
    }
  };

  const confirmPicker = async () => {
    if (!selectedFile) {
      toast.error('请先选择一个 .xlsx / .xls 文件');
      return;
    }
    try {
      const cfg = await xmPlayerSetExcelPath(selectedFile);
      setPickerOpen(false);
      if (cfg.excelPath) {
        toast.success('Excel 已更换，正在读取…');
        await reload(false);
      }
    } catch (e) {
      toast.error(extractApiError(e, '设置 Excel 失败'));
    }
  };

  const handleOpenFolder = async () => {
    try {
      await xmPlayerOpenFolder();
    } catch (e) {
      toast.error(extractApiError(e, '打开文件夹失败'));
    }
  };

  const handleStatusChange = async (col: XmPlayerCollection, status: string) => {
    if (status === col.status) return;
    try {
      const r = await xmPlayerUpdateStatus({ collectionId: col.id, status });
      toast.success(r.message);
      await reload(false);
    } catch (e) {
      toast.error(extractApiError(e, '状态更新失败'));
    }
  };

  const handlePlayAction = async (col: XmPlayerCollection, action: 'play' | 'pause' | 'stop') => {
    try {
      const r = await xmPlayerPlay(col.id, action);
      toast.success(r.message);
      await reload(false);
    } catch (e) {
      toast.error(extractApiError(e, '操作失败'));
    }
  };

  const openColEditor = (col?: XmPlayerCollection) => {
    setColEditing(col ?? null);
    setColForm(
      col
        ? {
            id: col.id,
            name: col.name,
            url: col.url ?? '',
            totalEpisodes: col.totalEpisodes != null ? String(col.totalEpisodes) : '',
            note: col.note ?? '',
          }
        : {
            id: 'xm-' + Date.now().toString(36),
            name: '',
            url: '',
            totalEpisodes: '',
            note: '',
          },
    );
    setColEditorOpen(true);
  };

  const saveColEditor = async () => {
    if (!colForm.name.trim()) {
      toast.error('请填写合集名称');
      return;
    }
    setColSaving(true);
    try {
      const r = await xmPlayerUpsertCollection({
        id: colForm.id.trim(),
        name: colForm.name.trim(),
        url: colForm.url.trim(),
        totalEpisodes: colForm.totalEpisodes ? Number(colForm.totalEpisodes) : 0,
        note: colForm.note.trim(),
      });
      toast.success(r.message);
      setColEditorOpen(false);
      await reload(false);
    } catch (e) {
      toast.error(extractApiError(e, '保存合集失败'));
    } finally {
      setColSaving(false);
    }
  };

  const handleDeleteCol = async (col: XmPlayerCollection) => {
    if (!window.confirm(`确定删除合集「${col.name}」吗？进度记录也会一并删除`)) return;
    try {
      const r = await xmPlayerDeleteCollection(col.id);
      toast.success(r.message);
      await reload(false);
    } catch (e) {
      toast.error(extractApiError(e, '删除合集失败'));
    }
  };

  const addDraft = () => {
    const d = EMPTY_DRAFT();
    if (data?.collections?.length) d.collectionId = data.collections[0].id;
    setDraftForm(d);
  };

  const saveDraft = () => {
    if (!draftForm) return;
    if (draftForm.weekdays.length === 0) {
      toast.error('请至少选择一天');
      return;
    }
    if (!draftForm.start || !draftForm.end) {
      toast.error('请选择开始/结束时间');
      return;
    }
    if (!draftForm.collectionId) {
      toast.error('请选择合集');
      return;
    }
    const exists = scheduleDrafts.some((s) => s.id === draftForm.id);
    const next = exists
      ? scheduleDrafts.map((s) => (s.id === draftForm.id ? { ...draftForm } : s))
      : [...scheduleDrafts, { ...draftForm }];
    setScheduleDrafts(next);
    setDraftForm(null);
  };

  const removeDraft = (id: string) => {
    setScheduleDrafts((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleDraftEnabled = (id: string, enabled: boolean) => {
    setScheduleDrafts((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
  };

  const handleSaveSchedules = async () => {
    setSaving(true);
    try {
      const r = await xmPlayerSaveSchedules(scheduleDrafts);
      toast.success(r.message);
      await reload(false);
    } catch (e) {
      toast.error(extractApiError(e, '保存日程失败'));
    } finally {
      setSaving(false);
    }
  };

  const downloadExample = async () => {
    try {
      const res = await axiosForBackend({
        url: '/api/xm-player/example',
        method: 'GET',
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '喜马拉雅合集播放-示例.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(extractApiError(e, '下载示例失败'));
    }
  };

  const collectionName = (id: string): string =>
    data?.collections?.find((c) => c.id === id)?.name ?? id;

  const tabs = [
    { key: 'collections' as const, label: '合集', icon: ListMusic },
    { key: 'schedules' as const, label: '日程', icon: CalendarDays },
    { key: 'info' as const, label: '功能说明', icon: Info },
  ];

  return (
    <div className="relative min-h-[calc(100vh-64px)] px-4 py-6 text-zinc-100">
      <BackgroundGlow />
      <div className="relative mx-auto max-w-6xl">
        {/* 头部 + 配置区 */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Radio className="h-5 w-5 text-cyan-400" />
            喜马拉雅合集播放
          </div>
          <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-300">Excel 数据源 · 影刀 RPA 执行</Badge>
        </div>

        <Card className="mb-5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-zinc-200">
                {excelPath || '尚未配置 Excel 文件'}
              </div>
              <div className="text-[11px] text-zinc-500">
                Excel 包含「合集 / 进度 / 日程」三个工作表；文件被修改保存后影刀文件触发器会自动运行
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openPicker()} disabled={loading}>
                <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                {excelPath ? '更换 Excel' : '选择 Excel'}
              </Button>
              {excelPath && (
                <Button variant="ghost" size="sm" onClick={handleOpenFolder}>
                  <FolderOpen className="mr-1 h-3.5 w-3.5" />
                  打开文件夹
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Tab 切换 */}
        <div className="mb-4 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                tab === t.key
                  ? 'bg-indigo-500/20 text-indigo-200'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ===== 合集 ===== */}
        {tab === 'collections' && (
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-zinc-300">
                合集列表
                {data && <span className="ml-2 text-[11px] text-zinc-500">共 {data.collections.length} 个专辑</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => openColEditor()} disabled={loading || !excelPath}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  新增合集
                </Button>
                <Button variant="outline" size="sm" onClick={() => reload(true)} disabled={loading || !excelPath}>
                  <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  刷新同步
                </Button>
              </div>
            </div>
            {!excelPath ? (
              <div className="py-10 text-center text-sm text-zinc-500">
                请先在上方选择包含合集信息的 Excel 文件
              </div>
            ) : data && data.collections.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-500">「合集」表中暂无数据</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-zinc-500">
                      <th className="px-3 py-2">名称</th>
                      <th className="px-3 py-2">链接</th>
                      <th className="px-3 py-2">总集数</th>
                      <th className="px-3 py-2">状态</th>
                      <th className="px-3 py-2">播放进度</th>
                      <th className="px-3 py-2">进度更新</th>
                      <th className="px-3 py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.collections ?? []).map((c) => (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-3 py-2">
                          <div className="font-medium text-zinc-200">{c.name}</div>
                          <div className="text-[11px] text-zinc-500">{c.id}</div>
                        </td>
                        <td className="max-w-[220px] truncate px-3 py-2">
                          {c.url ? (
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-300 hover:underline"
                            >
                              {c.url}
                            </a>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-zinc-400">{c.totalEpisodes ?? '-'}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] ${STATUS_STYLE[c.status ?? '待播放'] ?? STATUS_STYLE['待播放']}`}>
                              {c.status ?? '待播放'}
                            </span>
                            <select
                              value={c.status ?? '待播放'}
                              onChange={(e) => handleStatusChange(c, e.target.value)}
                              className="rounded-md border border-white/10 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-300 outline-none"
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {c.currentIndex != null ? (
                            <div className="text-zinc-300">
                              {c.totalEpisodes ? `${c.currentIndex}/${c.totalEpisodes}` : `第 ${c.currentIndex} 集`}
                              {c.currentTitle && <span className="ml-1 text-[11px] text-zinc-500">· {c.currentTitle}</span>}
                            </div>
                          ) : (
                            <span className="text-zinc-600">尚未开始</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-zinc-500">{fmtTime(c.progressUpdatedAt)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            {(c.status === '未开始' || c.status === '已暂停' || c.status === '已完成') && (
                              <button
                                type="button"
                                onClick={() => handlePlayAction(c, 'play')}
                                title="播放（通知影刀）"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/30"
                              >
                                <Play className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {c.status === '播放中' && (
                              <button
                                type="button"
                                onClick={() => handlePlayAction(c, 'pause')}
                                title="暂停（通知影刀）"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-300 hover:bg-amber-500/30"
                              >
                                <Pause className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {(c.status === '待播放' || c.status === '播放中' || c.status === '已暂停') && (
                              <button
                                type="button"
                                onClick={() => handlePlayAction(c, 'stop')}
                                title="停止（通知影刀）"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/15 text-rose-300 hover:bg-rose-500/30"
                              >
                                <Square className="h-3 w-3" />
                              </button>
                            )}
                            {c.status === '待停止' && (
                              <span className="text-[11px] text-orange-300">等待停止…</span>
                            )}
                            <button
                              type="button"
                              onClick={() => openColEditor(c)}
                              title="编辑合集"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-zinc-500/15 text-zinc-300 hover:bg-zinc-500/30"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCol(c)}
                              title="删除合集"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-400 hover:bg-rose-500/25"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ===== 日程 ===== */}
        {tab === 'schedules' && (
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-zinc-300">
                播放日程
                <span className="ml-2 text-[11px] text-zinc-500">保存后写回 Excel 日程表</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addDraft} disabled={!data?.collections?.length}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  新增时段
                </Button>
                <Button size="sm" onClick={handleSaveSchedules} disabled={saving || !excelPath}>
                  <Save className="mr-1 h-3.5 w-3.5" />
                  保存日程
                </Button>
              </div>
            </div>
            {!excelPath ? (
              <div className="py-10 text-center text-sm text-zinc-500">请先配置 Excel 文件</div>
            ) : scheduleDrafts.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-500">
                暂无日程时段，点击「新增时段」创建
              </div>
            ) : (
              <div className="space-y-2">
                {scheduleDrafts.map((s) => (
                  <div
                    key={s.id}
                    className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${
                      s.enabled ? 'border-white/10 bg-white/[0.02]' : 'border-white/5 bg-transparent opacity-60'
                    }`}
                  >
                    <Switch checked={s.enabled} onCheckedChange={(v) => toggleDraftEnabled(s.id, v)} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-zinc-200">
                        {s.start} - {s.end}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {s.weekdays.join('、')} · {collectionName(s.collectionId)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDraftForm({
                          id: s.id,
                          enabled: s.enabled,
                          weekdays: [...s.weekdays],
                          start: s.start,
                          end: s.end,
                          collectionId: s.collectionId,
                        })
                      }
                    >
                      <Edit2 className="h-3.5 w-3.5 text-zinc-400 hover:text-indigo-300" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeDraft(s.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-zinc-500 hover:text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* 新增/编辑时段弹框 */}
            {draftForm && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                onClick={() => setDraftForm(null)}
              >
                <div
                  className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-100">
                      {scheduleDrafts.some((x) => x.id === draftForm.id) ? '编辑播放时段' : '新增播放时段'}
                    </h3>
                    <button onClick={() => setDraftForm(null)} className="text-zinc-500 hover:text-zinc-300">
                      ✕
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">选择星期</label>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEK_LABELS.map((w) => {
                          const on = draftForm.weekdays.includes(w);
                          return (
                            <button
                              key={w}
                              type="button"
                              onClick={() =>
                                setDraftForm({
                                  ...draftForm,
                                  weekdays: on
                                    ? draftForm.weekdays.filter((x) => x !== w)
                                    : [...draftForm.weekdays, w],
                                })
                              }
                              className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                                on
                                  ? 'bg-indigo-500/30 text-indigo-200'
                                  : 'bg-white/[0.04] text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {w}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-zinc-400">开始时间</label>
                        <input
                          type="time"
                          value={draftForm.start}
                          onChange={(e) => setDraftForm({ ...draftForm, start: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-zinc-400">结束时间</label>
                        <input
                          type="time"
                          value={draftForm.end}
                          onChange={(e) => setDraftForm({ ...draftForm, end: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">播放合集</label>
                      <select
                        value={draftForm.collectionId}
                        onChange={(e) => setDraftForm({ ...draftForm, collectionId: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none"
                      >
                        {(data?.collections ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}（{c.id}）
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="ghost" size="sm" onClick={() => setDraftForm(null)}>
                        取消
                      </Button>
                      <Button size="sm" onClick={saveDraft}>
                        确定
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ===== 功能说明 ===== */}
        {tab === 'info' && (
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300">
                <Info className="h-4 w-4 text-cyan-400" /> 插件说明
              </h3>
              <div className="space-y-2 text-sm leading-relaxed text-zinc-400">
                <p>本插件以 <b className="text-zinc-200">Excel 文件为唯一数据源</b>，管理喜马拉雅专辑合集的播放与日程，实际播放由 <b className="text-zinc-200">影刀 RPA 工作流</b> 执行（通过影刀「文件触发器」监听 Excel 变化自动运行）。</p>
                <p>数据流：<span className="text-zinc-200">Excel（合集/进度/日程）→ 插件读取展示 → 状态修改保存 → 影刀文件触发器 → 影刀播放 → 回写进度/状态到 Excel → 插件刷新展示</span>。</p>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300">
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> 示例 Excel
              </h3>
              <p className="mb-3 text-sm text-zinc-400">
                下载示例文件，按同样的工作表与列头整理你的合集数据后，在页面顶部选择该文件即可。
              </p>
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <FileSpreadsheet className="h-8 w-8 text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-zinc-200">喜马拉雅合集播放-示例.xlsx</div>
                  <div className="text-[11px] text-zinc-500">
                    含「合集」「进度」「日程」三个工作表
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={downloadExample}>
                  <Download className="mr-1 h-3.5 w-3.5" />
                  下载
                </Button>
              </div>
              <div className="overflow-x-auto text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="text-zinc-500">
                      <th className="px-2 py-1 text-left">工作表</th>
                      <th className="px-2 py-1 text-left">列头</th>
                      <th className="px-2 py-1 text-left">说明</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-400">
                    <tr>
                      <td className="px-2 py-1 font-medium text-zinc-300">合集</td>
                      <td className="px-2 py-1">合集ID / 名称 / 链接 / 总集数 / 状态 / 备注</td>
                      <td className="px-2 py-1">每行一个专辑；状态改为「待播放」并保存即触发影刀</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 font-medium text-zinc-300">进度</td>
                      <td className="px-2 py-1">合集ID / 当前集索引 / 当前集名称 / 更新时间</td>
                      <td className="px-2 py-1">由影刀播放时回写，插件只读展示</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 font-medium text-zinc-300">日程</td>
                      <td className="px-2 py-1">时段ID / 启用 / 星期 / 开始时间 / 结束时间 / 合集ID</td>
                      <td className="px-2 py-1">在「日程」页编辑保存，写回本表</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300">
                <CalendarDays className="h-4 w-4 text-amber-400" /> 影刀 RPA 配置（文件触发器）
              </h3>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-400">
                <li>在影刀 RPA 中创建一个工作流：读取 Excel 中状态为「待播放」的合集，打开喜马拉雅客户端播放对应专辑；播放中/完成后回写「进度」与「状态」列并保存 Excel。</li>
                <li>为该工作流配置 <b className="text-zinc-200">文件触发器</b>：监控本插件使用的 Excel 文件路径，文件内容变化即自动运行。</li>
                <li>工作流开始时先判断：若没有「待播放」的合集则直接结束（日程保存、状态同步等操作不会误触发播放）。</li>
                <li>播放进度由影刀在「进度」工作表中回写（合集ID + 当前集索引/名称 + 更新时间），插件刷新即可看到最新进度。</li>
              </ol>
            </Card>
          </div>
        )}

        {/* ===== 选择 Excel 文件弹框（目录浏览） ===== */}
        {pickerOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setPickerOpen(false)}
          >
            <div
              className="flex h-[70vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                  选择 Excel 文件
                </h3>
                <button onClick={() => setPickerOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                  ✕
                </button>
              </div>
              {/* 路径栏 */}
              <div className="mb-2 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigatePicker(null)}
                  disabled={pickerLoading}
                  title="返回盘符列表"
                >
                  <HardDrive className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigatePicker(pickerData?.parent ?? null)}
                  disabled={pickerLoading || !pickerData?.parent}
                  title="返回上级目录"
                >
                  <FolderUp className="h-3.5 w-3.5" />
                </Button>
                <div className="min-w-0 flex-1 truncate rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-zinc-300">
                  {pickerData?.path ?? '我的电脑'}
                </div>
              </div>
              {/* 列表 */}
              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02]">
                {pickerLoading ? (
                  <div className="p-6 text-center text-xs text-zinc-500">读取中…</div>
                ) : (
                  <div className="p-1.5">
                    {/* 盘符 */}
                    {pickerData && !pickerData.path && (
                      <div className="grid grid-cols-3 gap-1.5">
                        {pickerData.drives.map((d) => (
                          <button
                            key={d}
                            onClick={() => navigatePicker(d)}
                            className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-left text-xs text-zinc-300 hover:bg-white/[0.05]"
                          >
                            <HardDrive className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                            {d}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* 目录 */}
                    {pickerData?.dirs.map((d) => (
                      <button
                        key={d}
                        onClick={() => navigatePicker(`${pickerData.path}\\${d}`)}
                        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/[0.05]"
                      >
                        <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        {d}
                      </button>
                    ))}
                    {/* 文件 */}
                    {pickerData?.files.map((f) => (
                      <button
                        key={f.path}
                        onClick={() => setSelectedFile(f.path)}
                        className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs ${
                          selectedFile === f.path
                            ? 'bg-emerald-500/20 text-emerald-200'
                            : 'text-zinc-300 hover:bg-white/[0.05]'
                        }`}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        <span className="truncate">{f.name}</span>
                      </button>
                    ))}
                    {pickerData && !pickerData.path && pickerData.drives.length === 0 && (
                      <div className="p-6 text-center text-xs text-zinc-500">未发现可用盘符</div>
                    )}
                    {pickerData?.path &&
                      pickerData.dirs.length === 0 &&
                      pickerData.files.length === 0 && (
                        <div className="p-6 text-center text-xs text-zinc-500">此目录下没有 Excel 文件</div>
                      )}
                  </div>
                )}
              </div>
              {/* 已选文件 */}
              <div className="mt-2 min-h-[28px] truncate text-xs text-zinc-400">
                {selectedFile ? (
                  <span className="text-emerald-300">已选：{selectedFile}</span>
                ) : (
                  <span className="text-zinc-600">请选择 .xlsx / .xls 文件</span>
                )}
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPickerOpen(false)}>
                  取消
                </Button>
                <Button size="sm" onClick={confirmPicker} disabled={!selectedFile || pickerLoading}>
                  确定
                </Button>
              </div>
            </div>
          </div>
        )}

        {colEditorOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setColEditorOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-100">
                  {colEditing ? '编辑合集' : '新增合集'}
                </h3>
                <button onClick={() => setColEditorOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                  ✕
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">合集ID（用于日程绑定，新增后不可改）</label>
                  <input
                    value={colForm.id}
                    onChange={(e) => setColForm({ ...colForm, id: e.target.value })}
                    disabled={!!colEditing}
                    className="w-full rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-zinc-200 outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">名称 *</label>
                  <input
                    value={colForm.name}
                    onChange={(e) => setColForm({ ...colForm, name: e.target.value })}
                    placeholder="例如：米小圈上学记二年级"
                    className="w-full rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-zinc-200 outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">喜马拉雅专辑链接</label>
                  <input
                    value={colForm.url}
                    onChange={(e) => setColForm({ ...colForm, url: e.target.value })}
                    placeholder="https://www.ximalaya.com/album/xxxxx"
                    className="w-full rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-zinc-200 outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">总集数</label>
                  <input
                    value={colForm.totalEpisodes}
                    onChange={(e) => setColForm({ ...colForm, totalEpisodes: e.target.value.replace(/\D/g, '') })}
                    placeholder="例如：120"
                    className="w-full rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-zinc-200 outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">备注</label>
                  <input
                    value={colForm.note}
                    onChange={(e) => setColForm({ ...colForm, note: e.target.value })}
                    className="w-full rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm text-zinc-200 outline-none"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setColEditorOpen(false)}>
                  取消
                </Button>
                <Button size="sm" onClick={saveColEditor} disabled={colSaving}>
                  {colSaving ? '保存中…' : '保存'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

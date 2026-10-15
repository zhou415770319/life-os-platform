import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  LogOut,
  MonitorPlay,
  MonitorStop,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Tv,
  FolderOpen,
  FolderUp,
  HardDrive,
  Settings as SettingsIcon,
  ScrollText,
  BarChart3,
  Video,
  Music,
  Eye,
  BookOpen,
  Clock,
  FileSearch,
} from 'lucide-react';
import { childTvApi, CHILD_TV_UNAUTHORIZED_EVENT } from '@client/src/api';
import type {
  ChildTvBrowseResult,
  ChildTvCollection,
  ChildTvSchedule,
  ChildTvScheduleInput,
} from '@shared/api.interface';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import { extractApiError } from '@client/src/utils/api-error';
import UsageDocModal from '@client/src/components/ui/UsageDocModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function weekdayLabel(weekdays: number[]): string {
  if (!weekdays || weekdays.length === 0) return '每天';
  if (weekdays.length === 7) return '每天';
  const sorted = [...weekdays].sort((a, b) => a - b);
  if (sorted.length === 5 && JSON.stringify(sorted) === JSON.stringify([1, 2, 3, 4, 5])) return '工作日';
  if (sorted.length === 2 && JSON.stringify(sorted) === JSON.stringify([6, 7])) return '周末';
  return sorted.map((w) => WEEK_LABELS[w - 1]).join('、');
}

interface ScheduleForm {
  id?: string;
  name: string;
  weekdays: number[];
  start: string;
  durationMinutes: number;
  collectionId: string;
  mediaType: 'video' | 'audio';
  enabled: boolean;
}

const EMPTY_FORM: ScheduleForm = {
  name: '',
  weekdays: [],
  start: '08:00',
  durationMinutes: 60,
  collectionId: '',
  mediaType: 'video',
  enabled: true,
};

function formatTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 合集编辑弹框：添加文件夹/文件（自动扫描按文件名排序）、添加 URL（直链或合集展开）、调整顺序 */
function CollectionDialog({
  open,
  editing,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: ChildTvCollection | null;
  onClose: () => void;
  onSave: (dto: { id?: string; name: string; items: ChildTvCollection['items'] }) => void;
}) {
  const [name, setName] = useState('');
  const [items, setItems] = useState<ChildTvCollection['items']>([]);
  const [picker, setPicker] = useState<{ mode: 'folder' | 'file' } | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveResult, setResolveResult] = useState<{
    isDirect: boolean;
    urls: string[];
    items?: { title?: string; url: string }[];
    platform?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setItems(editing ? [...(editing.items ?? [])] : []);
    setUrlInput('');
    setResolveResult(null);
  }, [open, editing]);

  if (!open) return null;

  const addFolder = (path: string) => {
    setItems((prev) => [...prev, { id: crypto.randomUUID(), type: 'folder', value: path }]);
    toast.success(`已添加文件夹：${path}（播放时自动扫描音视频并按文件名排序）`);
    setPicker(null);
  };

  const addFile = (path: string) => {
    setItems((prev) => [...prev, { id: crypto.randomUUID(), type: 'file', value: path }]);
    toast.success(`已添加文件：${path}`);
    setPicker(null);
  };

  const handleResolveUrl = async () => {
    const u = urlInput.trim();
    if (!u) return toast.error('请输入 URL');
    setResolving(true);
    setResolveResult(null);
    try {
      const r = await childTvApi.childTvResolveUrl(u);
      setResolveResult(r);
    } catch (e) {
      toast.error(extractApiError(e, '解析失败'));
    } finally {
      setResolving(false);
    }
  };

  const confirmAddUrls = () => {
    if (!resolveResult) return;
    const base = urlInput.trim();
    if (resolveResult.isDirect || resolveResult.urls.length <= 1) {
      setItems((prev) => [
        ...prev,
        { id: crypto.randomUUID(), type: 'url', value: base, title: resolveResult.items?.[0]?.title },
      ]);
      toast.success('已添加视频直链');
    } else {
      const adds = (resolveResult.items ?? resolveResult.urls.map((u): { title?: string; url: string } => ({ url: u }))).map((it) => ({
        id: crypto.randomUUID(),
        type: 'url' as const,
        value: it.url,
        title: it.title || undefined,
      }));
      setItems((prev) => [...prev, ...adds]);
      toast.success(`合集地址已展开，共添加 ${adds.length} 个视频`);
    }
    setUrlInput('');
    setResolveResult(null);
  };

  const move = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const itemLabel = (i: ChildTvCollection['items'][number]) =>
    i.type === 'folder' ? '文件夹' : i.type === 'file' ? '文件' : 'URL';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">
            {editing ? `编辑合集：${editing.name}` : '新建合集'}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">✕</button>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-zinc-400">合集名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：儿童纪录片 / 英语磨耳朵"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/60"
          />
        </div>

        {/* 添加方式 */}
        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-2 text-xs text-zinc-400">添加内容（文件夹自动扫描排序 / 直链 / 合集地址展开）</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setPicker({ mode: 'folder' })}>
              <FolderOpen className="mr-1 h-3.5 w-3.5" /> 添加文件夹
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPicker({ mode: 'file' })}>
              <FileSearch className="mr-1 h-3.5 w-3.5" /> 添加文件
            </Button>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="视频直链或合集地址（如 B 站合集页）"
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-indigo-400/60"
            />
            <Button variant="outline" size="sm" onClick={() => void handleResolveUrl()} disabled={resolving}>
              {resolving ? '解析中…' : '解析并添加'}
            </Button>
          </div>
          {resolveResult && (
            <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
              {resolveResult.isDirect || resolveResult.urls.length <= 1 ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-emerald-300">✓ 识别为视频直链</span>
                  <Button size="sm" onClick={confirmAddUrls}>
                    添加
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-indigo-300">
                      {resolveResult.platform === 'douyin-selected'
                        ? '识别为抖音精选合集'
                        : resolveResult.platform === 'bilibili'
                          ? '识别为 B 站视频/合集'
                          : resolveResult.platform === 'ximalaya'
                            ? '识别为喜马拉雅'
                            : '识别为合集地址'}
                      ，已提取 {resolveResult.urls.length} 个视频：
                    </span>
                    <Button size="sm" onClick={confirmAddUrls}>
                      全部添加
                    </Button>
                  </div>
                  {/* 视频名称 + URL 列表 */}
                  <div className="mt-2 max-h-44 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10">
                    {(resolveResult.items ?? resolveResult.urls.map((u): { title?: string; url: string } => ({ url: u }))).map((it, i) => (
                      <div key={i} className="flex items-start gap-2 px-2 py-1.5">
                        <span className="w-6 shrink-0 text-right text-zinc-600">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          {it.title && (
                            <div className="truncate font-medium text-zinc-200" title={it.title}>
                              {it.title}
                            </div>
                          )}
                          <div className="truncate font-mono text-[10px] text-zinc-500" title={it.url}>
                            {it.url}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {resolveResult.error && <div className="mt-1 text-amber-400/90">提示：{resolveResult.error}</div>}
            </div>
          )}
        </div>

        {/* 条目列表（顺序 = 播放顺序，支持调整） */}
        <div className="mb-4">
          <label className="mb-1 block text-xs text-zinc-400">
            播放条目（共 {items.length} 项，从上到下按顺序播放）
          </label>
          <div className="max-h-72 divide-y divide-white/5 overflow-y-auto rounded-xl border border-white/10">
            {items.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-zinc-500">
                还没有条目，请在上方添加文件夹 / 文件 / URL
              </div>
            )}
            {items.map((i, idx) => (
              <div key={i.id} className="flex items-center gap-2 px-3 py-2">
                <span className="w-6 shrink-0 text-right text-xs text-zinc-600">{idx + 1}</span>
                <Badge variant="outline" className="shrink-0">
                  {itemLabel(i)}
                </Badge>
                <div className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-300" title={i.value}>
                  {i.title ? `${i.title} · ` : ''}
                  {i.value}
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={idx === 0}
                    onClick={() => move(idx, -1)}
                    title="上移"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={idx === items.length - 1}
                    onClick={() => move(idx, 1)}
                    title="下移"
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-rose-400"
                    onClick={() => setItems((prev) => prev.filter((_, x) => x !== idx))}
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            文件夹条目会在播放时自动扫描其下全部音视频，并按文件名排序后插入对应位置。
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => {
              if (!name.trim()) return toast.error('请输入合集名称');
              onSave({ id: editing?.id, name: name.trim(), items });
            }}
          >
            保存合集
          </Button>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
        </div>

        {/* 文件夹/文件选择器 */}
        {picker && (
          <FilePickerDialog
            open
            onClose={() => setPicker(null)}
            pickMode={picker.mode}
            title={picker.mode === 'folder' ? '选择文件夹（自动扫描音视频）' : '选择媒体文件'}
            onPick={(p) => (picker.mode === 'folder' ? addFolder(p) : addFile(p))}
          />
        )}
      </div>
    </div>
  );
}

/** 时间选择弹框（小时 + 分钟，5 分钟粒度） */
function TimePickerDialog({
  open,
  value,
  onClose,
  onConfirm,
}: {
  open: boolean;
  value: string;
  onClose: () => void;
  onConfirm: (v: string) => void;
}) {
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (!open) return;
    const [hRaw = '8', mRaw = '0'] = (value || '08:00').split(':');
    const h = parseInt(hRaw, 10);
    const m = parseInt(mRaw, 10);
    setHour(Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 8);
    setMinute(Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0);
  }, [open, value]);

  if (!open) return null;

  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">选择开始时间</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">✕</button>
        </div>

        <div className="mb-4 text-center text-3xl font-semibold tabular-nums text-indigo-300">
          {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
        </div>

        <div className="mb-1.5 text-xs text-zinc-400">小时</div>
        <div className="mb-4 grid grid-cols-8 gap-1.5">
          {Array.from({ length: 24 }, (_, i) => i).map((h) => (
            <button
              key={h}
              onClick={() => setHour(h)}
              className={`rounded-md py-1.5 text-sm tabular-nums transition-colors ${
                hour === h
                  ? 'bg-indigo-500/90 text-white'
                  : 'bg-white/[0.04] text-zinc-300 hover:bg-white/10'
              }`}
            >
              {String(h).padStart(2, '0')}
            </button>
          ))}
        </div>

        <div className="mb-1.5 text-xs text-zinc-400">分钟（5 分钟粒度）</div>
        <div className="mb-5 grid grid-cols-6 gap-1.5">
          {minutes.map((m) => (
            <button
              key={m}
              onClick={() => setMinute(m)}
              className={`rounded-md py-1.5 text-sm tabular-nums transition-colors ${
                minute === m
                  ? 'bg-indigo-500/90 text-white'
                  : 'bg-white/[0.04] text-zinc-300 hover:bg-white/10'
              }`}
            >
              {String(m).padStart(2, '0')}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button
            size="sm"
            onClick={() =>
              onConfirm(
                `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
              )
            }
          >
            确定
          </Button>
        </div>
      </div>
    </div>
  );
}

/** 文件/文件夹选择器（云函数 listDir 数据源，替代不可见的系统对话框） */
function FilePickerDialog({
  open,
  onClose,
  onPick,
  pickMode,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (path: string) => void;
  pickMode: 'file' | 'folder';
  title?: string;
}) {
  const [currentPath, setCurrentPath] = useState<string | null>(null);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['child-tv-listdir-cloud', currentPath],
    queryFn: () => childTvApi.childTvListDirCloud(currentPath ?? undefined),
    enabled: open,
    placeholderData: (prev: ChildTvBrowseResult | undefined) =>
      prev ?? { path: null, parent: null, drives: [], dirs: [], files: [] },
  });

  const enterDir = (dir: string) => {
    const base = currentPath ?? '';
    setCurrentPath(base ? `${base}\\${dir}` : dir);
  };

  useEffect(() => {
    if (open) setCurrentPath(null);
  }, [open]);

  if (!open) return null;

  const errMsg = extractApiError(error, '加载失败');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">{title ?? '选择文件'}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">✕</button>
        </div>

        <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
          <HardDrive className="h-3.5 w-3.5" />
          <span className="truncate font-mono">{currentPath ?? '（选择盘符）'}</span>
        </div>

        {isError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-xs text-red-300">
            目录加载失败：{errMsg ?? '未知错误'}
            <div className="mt-2">请确认「儿童定时播放」插件已启用（云函数 listDir 可用）</div>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-xl border border-white/10">
            {!currentPath && (
              <div className="divide-y divide-white/5">
                {(data?.drives ?? []).map((d) => (
                  <button
                    key={d}
                    onClick={() => setCurrentPath(d)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-zinc-200 hover:bg-white/5"
                  >
                    <HardDrive className="h-4 w-4 text-indigo-400" /> {d}
                  </button>
                ))}
              </div>
            )}

            {currentPath && (
              <div className="divide-y divide-white/5">
                {data?.parent && (
                  <button
                    onClick={() => setCurrentPath(data.parent ?? null)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-zinc-300 hover:bg-white/5"
                  >
                    <FolderUp className="h-4 w-4 text-amber-400" /> ..（上级目录）
                  </button>
                )}
                {(data?.dirs ?? []).map((dir) => (
                  <button
                    key={dir}
                    onClick={() => enterDir(dir)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-zinc-200 hover:bg-white/5"
                  >
                    <FolderOpen className="h-4 w-4 text-amber-400" /> {dir}
                  </button>
                ))}
                {(data?.files ?? []).map((f) => (
                  <button
                    key={f.path}
                    onClick={() => {
                      if (pickMode === 'file') {
                        onPick(f.path);
                        onClose();
                      }
                    }}
                    disabled={pickMode !== 'file'}
                    className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm ${
                      pickMode === 'file'
                        ? 'text-zinc-200 hover:bg-white/5'
                        : 'cursor-default text-zinc-500'
                    }`}
                  >
                    {f.kind === 'video' ? (
                      <Video className="h-4 w-4 text-indigo-400" />
                    ) : f.kind === 'audio' ? (
                      <Music className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <FileSearch className="h-4 w-4 text-sky-400" />
                    )}
                    <span className="flex-1 truncate">{f.name}</span>
                    <Badge variant="outline" className="shrink-0">{f.kind}</Badge>
                  </button>
                ))}
                {isFetching && <div className="px-4 py-3 text-xs text-zinc-500">加载中...</div>}
                {(data?.dirs ?? []).length === 0 &&
                  (data?.files ?? []).length === 0 &&
                  !isFetching && (
                    <div className="px-4 py-6 text-center text-xs text-zinc-500">
                      该目录下没有内容
                    </div>
                  )}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-zinc-500">
            {pickMode === 'folder'
              ? '进入目标文件夹后点击「选择当前文件夹」'
              : '点击文件回填路径（mpv 请选择 mpv.exe）'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
            {pickMode === 'folder' && currentPath && (
              <Button
                size="sm"
                onClick={() => {
                  onPick(currentPath);
                  onClose();
                }}
              >
                <FolderOpen className="mr-1 h-3.5 w-3.5" /> 选择当前文件夹
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChildTvAdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(childTvApi.getChildTvToken());
  const [loginName, setLoginName] = useState('admin');
  const [loginPwd, setLoginPwd] = useState('');
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [selectedPlayId, setSelectedPlayId] = useState('');
  const [weekFilter, setWeekFilter] = useState<'all' | number>('all');
  const [collectionDialog, setCollectionDialog] = useState<{ open: boolean; editing: ChildTvCollection | null }>({
    open: false,
    editing: null,
  });
  const [activeTab, setActiveTab] = useState<'console' | 'schedules' | 'collections' | 'records' | 'settings'>('console');
  // 使用说明弹窗
  const [usageOpen, setUsageOpen] = useState(false);
  const { data: usage } = useQuery({
    queryKey: ['child-tv-usage'],
    queryFn: childTvApi.childTvGetUsage,
    enabled: usageOpen,
  });
  const [formOpen, setFormOpen] = useState(false);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['child-tv'] });
  }, [queryClient]);

  const { data: auth } = useQuery({
    queryKey: ['child-tv-me', token],
    queryFn: childTvApi.childTvMe,
    enabled: !!token,
  });

  // ===== 状态 / 时段 / 日志 / 统计 / 设置 =====

  const { data: status } = useQuery({
    queryKey: ['child-tv-status', token],
    queryFn: childTvApi.childTvStatus,
    enabled: !!token,
    refetchInterval: 10_000,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['child-tv-schedules', token],
    queryFn: childTvApi.childTvListSchedules,
    enabled: !!token,
  });

  const { data: collections = [] } = useQuery({
    queryKey: ['child-tv-collections', token],
    queryFn: childTvApi.childTvListCollections,
    enabled: !!token,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['child-tv-logs', token],
    queryFn: childTvApi.childTvLogs,
    enabled: !!token,
    refetchInterval: 10_000,
  });

  const { data: stats = [] } = useQuery({
    queryKey: ['child-tv-stats', token],
    queryFn: childTvApi.childTvStats,
    enabled: !!token,
  });

  const { data: settings } = useQuery({
    queryKey: ['child-tv-settings', token],
    queryFn: childTvApi.childTvGetSettings,
    enabled: !!token,
  });

  // ===== 打开所在文件夹（支持快捷键 Ctrl+Shift+O） =====
  const [openingDir, setOpeningDir] = useState(false);
  const handleOpenDataDir = useCallback(async () => {
    setOpeningDir(true);
    try {
      const res = await childTvApi.childTvOpenDataDir();
      if (res.success) {
        toast.success(`已打开插件数据文件夹：${res.dataDir}`);
      } else {
        toast.error('打开文件夹失败');
      }
    } catch {
      toast.error('打开文件夹失败');
    } finally {
      setOpeningDir(false);
    }
  }, []);

  // 键盘快捷键：Ctrl+Shift+O 打开插件所在文件夹
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        void handleOpenDataDir();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleOpenDataDir]);

  // ===== 登录 =====
  const loginMutation = useMutation({
    mutationFn: () => childTvApi.childTvLogin(loginName, loginPwd),
    onSuccess: () => {
      setToken(childTvApi.getChildTvToken());
      setLoginPwd('');
      toast.success('登录成功');
      refresh();
    },
    onError: () => toast.error('登录失败，请检查用户名和密码'),
  });

  const handleLogout = () => {
    childTvApi.childTvLogout();
    setToken(null);
    toast.success('已退出登录');
  };

  // 登录失效（token 过期/无效）时自动清除本地状态并切回登录界面
  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null);
      toast.error('登录已过期，请重新登录');
    };
    window.addEventListener(CHILD_TV_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(CHILD_TV_UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // ===== 时段 CRUD =====
  const saveMutation = useMutation({
    mutationFn: (dto: ChildTvScheduleInput) =>
      form.id
        ? childTvApi.childTvUpdateSchedule(form.id, dto)
        : childTvApi.childTvCreateSchedule(dto),
    onSuccess: () => {
      toast.success(form.id ? '时段已更新' : '时段已创建');
      setForm(EMPTY_FORM);
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['child-tv-schedules'] });
    },
    onError: (e) => {
      const msg = extractApiError(e, '保存失败');
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => childTvApi.childTvDeleteSchedule(id),
    onSuccess: () => {
      toast.success('时段已删除');
      queryClient.invalidateQueries({ queryKey: ['child-tv-schedules'] });
    },
  });

  // 启用/停用快速切换：后端 updateSchedule 支持 Partial 合并，只传 enabled 即可
  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      childTvApi.childTvUpdateSchedule(id, { enabled }),
    onSuccess: () => {
      toast.success('时段状态已更新');
      queryClient.invalidateQueries({ queryKey: ['child-tv-schedules'] });
    },
    onError: (e) => {
      toast.error(extractApiError(e, '状态更新失败'));
    },
  });

  const handleSave = () => {
    if (!form.name.trim()) return toast.error('请输入时段名称');
    if (!form.collectionId) return toast.error('请选择播放合集');
    saveMutation.mutate({
      name: form.name,
      weekdays: form.weekdays,
      start: form.start,
      durationMinutes: Number(form.durationMinutes),
      collectionId: form.collectionId,
      mediaType: form.mediaType,
      enabled: form.enabled,
    });
  };

  const startEdit = (s: ChildTvSchedule) => {
    setForm({
      id: s.id,
      name: s.name,
      weekdays: s.weekdays ?? [],
      start: s.start,
      durationMinutes: s.durationMinutes,
      collectionId: s.collectionId,
      mediaType: s.mediaType,
      enabled: s.enabled,
    });
    setFormOpen(true);
  };

  // ===== 合集 CRUD =====
  const saveCollectionMutation = useMutation({
    mutationFn: (dto: { id?: string; name: string; items: ChildTvCollection['items'] }) =>
      dto.id
        ? childTvApi.childTvUpdateCollection(dto.id, { name: dto.name, items: dto.items })
        : childTvApi.childTvCreateCollection({ name: dto.name, items: dto.items }),
    onSuccess: () => {
      toast.success('合集已保存');
      queryClient.invalidateQueries({ queryKey: ['child-tv-collections'] });
      queryClient.invalidateQueries({ queryKey: ['child-tv-schedules'] });
    },
    onError: (e) => {
      const msg = extractApiError(e, '保存失败');
      toast.error(msg);
    },
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      childTvApi.childTvDeleteCollection(id, force),
    onSuccess: (r, v) => {
      toast.success(
        r.detachedSchedules?.length
          ? `合集已删除，已解除时段绑定：${r.detachedSchedules.join('、')}`
          : '合集已删除',
      );
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['child-tv-collections'] });
      queryClient.invalidateQueries({ queryKey: ['child-tv-schedules'] });
    },
    onError: (e) => {
      toast.error(extractApiError(e, '删除失败'));
    },
  });

  // 删除确认：合集被时段使用时先弹框告知影响
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; usedBy: string[] } | null>(null);

  // ===== 控制 =====
  const playMutation = useMutation({
    mutationFn: (id: string) => childTvApi.childTvPlay(id),
    onSuccess: (s) => {
      toast.success(`正在播放：${s.currentTitle || '内容'}`);
      refresh();
    },
    onError: (e) => {
      toast.error(extractApiError(e, '播放失败'));
    },
  });

  const stopMutation = useMutation({
    mutationFn: childTvApi.childTvStop,
    onSuccess: () => {
      toast.success('已停止播放');
      refresh();
    },
  });

  // ===== 设置 =====
  const [pwd1, setPwd1] = useState('');
  const [pin, setPin] = useState('');
  const [mpvPath, setMpvPath] = useState('');
  const [timeOpen, setTimeOpen] = useState(false);
  const [mpvPickerOpen, setMpvPickerOpen] = useState(false);

  useEffect(() => {
    if (settings) {
      setMpvPath(settings.mpvPath || '');
    }
  }, [settings]);

  const settingsMutation = useMutation({
    mutationFn: () =>
      childTvApi.childTvUpdateSettings({
        mpvPath: mpvPath.trim(),
      }),
    onSuccess: () => {
      toast.success('设置已保存');
      refresh();
    },
    onError: () => toast.error('设置保存失败'),
  });

  const accountMutation = useMutation({
    mutationFn: () =>
      childTvApi.childTvUpdateAccount({
        password: pwd1 || undefined,
        pin: pin === '' ? null : pin,
      }),
    onSuccess: (r) => {
      toast.success(r.pinEnabled ? '账号与 PIN 已更新' : '账号已更新，PIN 已关闭');
      setPwd1('');
      setPin('');
      refresh();
    },
  });

  const remaining = status?.remainingMinutes ?? null;
  const next = status?.nextSchedule ?? null;
  const editing = useMemo(() => !!form.id, [form.id]);

  /** 按星期筛选的时段列表（'all'=全部） */
  const filteredSchedules = useMemo(() => {
    if (weekFilter === 'all') return schedules;
    return schedules.filter((s) => !(s.weekdays?.length) || s.weekdays.includes(weekFilter));
  }, [schedules, weekFilter]);

  // 未登录
  if (!token) {
    return (
      <div className="p-6 md:p-10 min-h-screen relative overflow-hidden">
        <BackgroundGlow variant="page" />
        <div className="mx-auto max-w-md pt-16">
          <Card className="p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-purple-500">
                <Tv className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-50">家长控制台</h2>
              <p className="mt-1 text-sm text-zinc-400">儿童定时播放・家长远程控制</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">用户名</label>
                <input
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">密码</label>
                <input
                  type="password"
                  value={loginPwd}
                  onChange={(e) => setLoginPwd(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loginMutation.mutate()}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/60"
                />
              </div>
              <Button className="w-full" onClick={() => loginMutation.mutate()} disabled={loginMutation.isPending}>
                {loginMutation.isPending ? '登录中...' : '登录'}
              </Button>
              <p className="text-center text-xs text-zinc-500">默认家长账号 admin / 123456</p>
            </div>
            <Link
              to="/child-tv"
              className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
            >
              <Eye className="h-4 w-4" /> 进入儿童观看页
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  // 儿童账号不允许进入控制台（只能看）
  // 单机模式：仅家长账号（admin）登录控制台，无儿童账号体系
  if (auth && auth.role === 'child') {
    return (
      <div className="p-6 md:p-10 min-h-screen relative overflow-hidden">
        <BackgroundGlow variant="page" />
        <div className="mx-auto max-w-md pt-16">
          <Card className="p-8 text-center">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-rose-400" />
            <h2 className="text-lg font-semibold text-zinc-50">这是家长控制台</h2>
            <p className="mt-2 text-sm text-zinc-400">
              当前登录的是儿童账号「{auth.username}」，不能进行控制操作。
              <br />
              儿童请在观看页使用。
            </p>
            <Button
              variant="outline"
              className="mt-5"
              onClick={handleLogout}
            >
              <LogOut className="mr-1 h-3.5 w-3.5" /> 退出并重新登录
            </Button>
            <Link
              to="/child-tv"
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
            >
              <Eye className="h-4 w-4" /> 进入儿童观看页
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 min-h-screen relative overflow-hidden">
      <BackgroundGlow variant="page" />

      {/* 头部 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-50">
            <Tv className="h-6 w-6 text-rose-400" /> 儿童定时播放
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            家长控制台 · 已登录 {auth?.username}
            {status?.mpvAvailable
              ? status.mpv === 'running'
                ? ' · mpv 播放中'
                : ' · mpv 就绪'
              : ' · ⚠ 未检测到 mpv'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setUsageOpen(true)} title="使用说明（家长/儿童均可查看）">
            <BookOpen className="mr-1 h-3.5 w-3.5" /> 使用说明
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/child-tv')} title="切换到儿童观看页（只读，无控制操作）">
            <Eye className="mr-1 h-3.5 w-3.5" /> 儿童观看
          </Button>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> 刷新
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-1 h-3.5 w-3.5" /> 退出登录
          </Button>
        </div>
      </div>

      {!status?.mpvAvailable && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          未检测到 mpv 播放器。请在设置页填写 mpv.exe 路径，或安装 mpv（官网 mpv.io）后重启服务。
        </div>
      )}

      {/* Tab 切换 */}
      <div className="mb-6 flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {(
          [
            ['console', '控制台', MonitorPlay],
            ['schedules', '日程', Tv],
            ['collections', '合集', FolderOpen],
            ['records', '日志与统计', BarChart3],
            ['settings', '设置', SettingsIcon],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
              activeTab === key
                ? 'bg-indigo-500/20 text-indigo-200 shadow-inner'
                : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* 控制台：实时状态 + 远程控制 */}
      {activeTab === 'console' && (
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <MonitorPlay className="h-4 w-4 text-indigo-400" /> 实时状态
            </h3>
            <button
              onClick={handleOpenDataDir}
              disabled={openingDir}
              className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {openingDir ? '打开中…' : '打开所在文件夹'}
              <kbd className="ml-1 rounded border border-white/15 bg-white/5 px-1 text-[10px] leading-4 text-zinc-400">
                Ctrl+Shift+O
              </kbd>
            </button>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3">
              <span className="text-zinc-400">播放状态</span>
              {status?.playing ? (
                <Badge className="bg-emerald-500/20 text-emerald-300">播放中</Badge>
              ) : (
                <Badge variant="outline" className="text-zinc-400">空闲</Badge>
              )}
            </div>
            {status?.playing && (
              <>
                <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3">
                  <span className="text-zinc-400">正在播放</span>
                  <span className="max-w-[60%] truncate font-medium text-zinc-100">
                    {status.currentTitle || '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3">
                  <span className="text-zinc-400">剩余</span>
                  <span className="font-medium text-zinc-100">
                    {remaining !== null ? `${remaining} 分钟` : '-'}
                    {status.manual && <span className="ml-2 text-[11px] text-indigo-400">(手动)</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3">
                  <span className="text-zinc-400">结束时间</span>
                  <span className="font-medium text-zinc-100">{formatTime(status.endsAt)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3">
              <span className="text-zinc-400">下一时段</span>
              {next ? (
                <span className="font-medium text-zinc-100">
                  {next.name}（{next.startLabel}，
                  {next.startsInMinutes > 0 ? `${next.startsInMinutes} 分钟后` : '即将开始'}）
                </span>
              ) : (
                <span className="text-zinc-500">无</span>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3">
              <span className="text-zinc-400">播放器</span>
              <span className="text-zinc-200">
                {status?.mpv === 'running' ? 'mpv 运行中' : status?.mpvAvailable ? '就绪' : '未安装'}
              </span>
            </div>
            <div className="truncate rounded-lg bg-white/[0.03] px-4 py-2 text-xs text-zinc-500">
              最近日志：{status?.lastLog || '-'}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
            <MonitorStop className="h-4 w-4 text-rose-400" /> 远程控制
          </h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">立即播放时段</label>
              <div className="flex gap-2">
                <select
                  value={selectedPlayId}
                  onChange={(e) => setSelectedPlayId(e.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/60"
                >
                  <option value="">选择要播放的时段...</option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}（{s.start} · {s.collectionName || '合集'}）
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  onClick={() => selectedPlayId && playMutation.mutate(selectedPlayId)}
                  disabled={!selectedPlayId || playMutation.isPending}
                >
                  <Play className="mr-1 h-3.5 w-3.5" /> 播放
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="outline"
                onClick={() => stopMutation.mutate()}
                disabled={!status?.playing || stopMutation.isPending}
              >
                <MonitorStop className="mr-1 h-3.5 w-3.5" /> 停止播放
              </Button>
            </div>

            <p className="text-[11px] leading-relaxed text-zinc-500">
              播放时会自动以 mpv 全屏并置顶播放（屏幕最上层）；停止或时段结束自动退出。
            </p>
          </div>
        </Card>
      </div>
      )}

      {/* 日程：星期筛选 + 时段列表 */}
      {activeTab === 'schedules' && (
        <Card className="mb-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-6 py-4">
            <h3 className="text-sm font-medium text-zinc-300">日程时段</h3>
            <div className="flex items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
                {(['all', 1, 2, 3, 4, 5, 6, 7] as const).map((w) => {
                  const key = String(w);
                  const label = w === 'all' ? '全部' : WEEK_LABELS[(w as number) - 1];
                  return (
                    <button
                      key={key}
                      onClick={() => setWeekFilter(w)}
                      className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                        weekFilter === w
                          ? 'bg-indigo-500/20 text-indigo-200'
                          : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setFormOpen(true); }}>
                <Plus className="mr-1 h-3.5 w-3.5" /> 添加时段
              </Button>
            </div>
          </div>
          <div className="divide-y divide-white/5">
            {filteredSchedules.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-zinc-500">
                当前筛选下没有时段，点击右上角「添加时段」创建一个
              </div>
            )}
          {filteredSchedules.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
              <div className="min-w-[150px]">
                <div className="text-sm font-medium text-zinc-100">{s.name}</div>
                <div className="text-xs text-zinc-500">
                  {weekdayLabel(s.weekdays)} · {s.start} 起 · {s.durationMinutes} 分钟
                  {s.durationMinutes + (Number(s.start.split(':')[0]) * 60 + Number(s.start.split(':')[1])) > 1440 && (
                    <span className="ml-1 text-amber-400/80">(跨天)</span>
                  )}
                </div>
              </div>
              <Badge variant="outline" className={s.mediaType === 'video' ? 'text-indigo-300' : 'text-emerald-300'}>
                {s.mediaType === 'video' ? '视频' : '音频'}
              </Badge>
              <Badge variant="outline" className="text-zinc-400">
                {s.collectionName || '（未选合集）'}
              </Badge>
              <div className="min-w-0 flex-1" />
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.enabled}
                  disabled={toggleMutation.isPending}
                  onCheckedChange={(v) => toggleMutation.mutate({ id: s.id, enabled: v })}
                  aria-label={s.enabled ? '停用时段' : '启用时段'}
                />
                <span className={`text-xs ${s.enabled ? 'text-emerald-300' : 'text-zinc-500'}`}>
                  {s.enabled ? '启用' : '停用'}
                </span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(s)}>
                  编辑
                </Button>
                <Button variant="ghost" size="sm" className="text-rose-400" onClick={() => deleteMutation.mutate(s.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      )}

      {/* 合集管理 */}
      {activeTab === 'collections' && (
        <Card className="mb-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
            <h3 className="text-sm font-medium text-zinc-300">播放合集</h3>
            <Button size="sm" onClick={() => setCollectionDialog({ open: true, editing: null })}>
              <Plus className="mr-1 h-3.5 w-3.5" /> 新建合集
            </Button>
          </div>
          <div className="divide-y divide-white/5">
            {collections.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-zinc-500">
                还没有合集，点击右上角「新建合集」创建（可添加文件夹自动扫描、或添加视频/合集 URL）
              </div>
            )}
            {collections.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                <div className="min-w-[140px]">
                  <div className="text-sm font-medium text-zinc-100">{c.name}</div>
                  <div className="text-xs text-zinc-500">{c.items.length} 个条目</div>
                </div>
                <div className="min-w-0 flex-1 truncate text-xs text-zinc-500">
                  {c.items.length === 0
                    ? '（空合集）'
                    : c.items
                        .map((i) =>
                          i.type === 'folder' ? `📁 ${i.value}` : i.type === 'file' ? `📄 ${i.value}` : `🔗 ${i.title || i.value}`,
                        )
                        .join('  ·  ')}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setCollectionDialog({ open: true, editing: c })}>
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-400"
                    onClick={() => {
                      const usedBy = schedules
                        .filter((s) => s.collectionId === c.id)
                        .map((s) => s.name);
                      if (usedBy.length) setDeleteTarget({ id: c.id, name: c.name, usedBy });
                      else deleteCollectionMutation.mutate({ id: c.id });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 日志 + 统计 */}
      {activeTab === 'records' && (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
            <ScrollText className="h-4 w-4 text-cyan-400" /> 运行日志
          </h3>
          <div className="max-h-72 space-y-1 overflow-y-auto font-mono text-xs">
            {logs.length === 0 && <div className="text-zinc-600">暂无日志</div>}
            {logs.map((l) => (
              <div key={l.id} className="flex gap-2 text-zinc-500">
                <span className="shrink-0 text-zinc-600">{new Date(l.time).toLocaleTimeString()}</span>
                <span
                  className={
                    l.level === 'error'
                      ? 'text-rose-400'
                      : l.level === 'warn'
                        ? 'text-amber-400'
                        : 'text-zinc-400'
                  }
                >
                  {l.message}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
            <BarChart3 className="h-4 w-4 text-emerald-400" /> 播放统计
          </h3>
          <div className="max-h-72 space-y-1 overflow-y-auto text-xs">
            {stats.length === 0 && <div className="text-zinc-600">暂无播放记录</div>}
            {stats.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2">
                <span className="truncate text-zinc-300">{s.name}</span>
                <span className="ml-3 shrink-0 text-zinc-500">
                  {new Date(s.startedAt).toLocaleString()} · {Math.round(s.durationSec / 60)} 分钟
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      )}

      {/* 设置 */}
      {activeTab === 'settings' && (
      <Card className="mt-6 p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
          <SettingsIcon className="h-4 w-4 text-amber-400" /> 设置
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">mpv 可执行文件路径（留空自动检测）</label>
            <div className="flex gap-2">
              <input
                value={mpvPath}
                onChange={(e) => setMpvPath(e.target.value)}
                placeholder="如 C:\Program Files\mpv\mpv.exe"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-indigo-400/60"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMpvPickerOpen(true)}
                title="打开文件选择器（云函数浏览目录）"
              >
                <FileSearch className="mr-1 h-3.5 w-3.5" />
                选择文件
              </Button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">观看页 PIN（留空关闭）</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="设置后观看页需输入 PIN"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">修改登录密码（留空不修改）</label>
            <input
              type="password"
              value={pwd1}
              onChange={(e) => setPwd1(e.target.value)}
              placeholder="新密码"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => settingsMutation.mutate()} disabled={settingsMutation.isPending}>
            保存设置
          </Button>
          <Button
            variant="ghost"
            className="border-indigo-400/20 text-indigo-300"
            onClick={() => accountMutation.mutate()}
            disabled={accountMutation.isPending}
          >
            保存账号 / PIN
          </Button>
        </div>
      </Card>
      )}

      {/* 时段新增 / 编辑弹框 */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setFormOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">
                {editing ? `编辑时段：${form.name || '…'}` : '新增时段'}
              </h3>
              <button onClick={() => setFormOpen(false)} className="text-zinc-500 hover:text-zinc-300">✕</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">时段名称</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：纪录片 / 英语 / 喜马拉雅"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">开始时间（HH:MM）</label>
                <button
                  type="button"
                  onClick={() => setTimeOpen(true)}
                  className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm tabular-nums text-zinc-100 outline-none transition-colors hover:border-indigo-400/60 focus:border-indigo-400/60"
                >
                  <span>{form.start || '--:--'}</span>
                  <Clock className="h-4 w-4 text-indigo-400" />
                </button>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">时长（分钟，1-1440，支持跨天）</label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">类型</label>
                <select
                  value={form.mediaType}
                  onChange={(e) => setForm({ ...form, mediaType: e.target.value as 'video' | 'audio' })}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none"
                >
                  <option value="video">视频</option>
                  <option value="audio">音频</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">播放合集</label>
                <select
                  value={form.collectionId}
                  onChange={(e) => setForm({ ...form, collectionId: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none"
                >
                  <option value="">选择合集…</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}（{c.items.length} 项）
                    </option>
                  ))}
                </select>
                {collections.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-400/80">暂无合集，请先到「合集」页创建</p>
                )}
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                  />
                  启用
                </label>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs text-zinc-400">适用星期（可多选，不选=每天）</label>
              <div className="flex flex-wrap gap-1.5">
                {WEEK_LABELS.map((label, i) => {
                  const w = i + 1;
                  const on = form.weekdays.includes(w);
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          weekdays: on ? form.weekdays.filter((x) => x !== w) : [...form.weekdays, w].sort((a, b) => a - b),
                        })
                      }
                      className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                        on
                          ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-200'
                          : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {editing ? '保存修改' : '创建时段'}
              </Button>
              <Button variant="ghost" onClick={() => setFormOpen(false)}>
                取消
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 开始时间选择弹框 */}
      <TimePickerDialog
        open={timeOpen}
        value={form.start}
        onClose={() => setTimeOpen(false)}
        onConfirm={(v) => {
          setForm((f) => ({ ...f, start: v }));
          setTimeOpen(false);
        }}
      />

      {/* 合集编辑弹框 */}
      <CollectionDialog
        open={collectionDialog.open}
        editing={collectionDialog.editing}
        onClose={() => setCollectionDialog({ open: false, editing: null })}
        onSave={(dto) => {
          saveCollectionMutation.mutate(dto);
          setCollectionDialog({ open: false, editing: null });
        }}
      />

      {/* mpv 路径文件选择器（云函数浏览） */}
      <FilePickerDialog
        open={mpvPickerOpen}
        onClose={() => setMpvPickerOpen(false)}
        pickMode="file"
        title="选择 mpv 可执行文件"
        onPick={(p) => {
          setMpvPath(p);
          toast.success('已选择文件，记得点击「保存设置」');
        }}
      />

      {/* 使用说明弹窗（家长/儿童均可查看） */}
      <UsageDocModal
        open={usageOpen}
        onClose={() => setUsageOpen(false)}
        title={usage?.title}
        content={usage?.content}
        footerNote="文档位置：user-data/plugins/dsh-plugin-child-tv/data/使用说明.md（控制台「打开所在文件夹」可直达）"
      />

      {/* 删除合集确认（被时段使用时） */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除合集「{deleteTarget?.name}」</DialogTitle>
            <DialogDescription>
              该合集正被以下时段使用：{deleteTarget?.usedBy.join('、')}。删除后这些时段将变为
              「未选合集」，播放时无法播放内容，需要重新选择合集。确定删除吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button
              className="text-rose-400"
              onClick={() => {
                if (deleteTarget) deleteCollectionMutation.mutate({ id: deleteTarget.id, force: true });
              }}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

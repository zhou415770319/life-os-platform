import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Lock,
  LockOpen,
  LogOut,
  MonitorPlay,
  MonitorStop,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Tv,
  FileUp,
  FolderOpen,
  FolderUp,
  HardDrive,
  Settings as SettingsIcon,
  ScrollText,
  BarChart3,
  Video,
  Music,
} from 'lucide-react';
import { childTvApi } from '@client/src/api';
import type {
  ChildTvBrowseResult,
  ChildTvSchedule,
  ChildTvScheduleInput,
} from '@shared/api.interface';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface ScheduleForm {
  id?: string;
  name: string;
  start: string;
  durationMinutes: number;
  sourceType: 'folder' | 'file' | 'url';
  source: string;
  mediaType: 'video' | 'audio';
  enabled: boolean;
}

const EMPTY_FORM: ScheduleForm = {
  name: '',
  start: '08:00',
  durationMinutes: 60,
  sourceType: 'folder',
  source: '',
  mediaType: 'video',
  enabled: true,
};

function formatTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 目录浏览选择器对话框 */
function BrowseDialog({
  open,
  onClose,
  onPick,
  pickMode,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (path: string) => void;
  pickMode: 'folder' | 'file';
}) {
  const [currentPath, setCurrentPath] = useState<string | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['child-tv-browse', currentPath],
    queryFn: () => childTvApi.childTvBrowse(currentPath ?? undefined),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">
            {pickMode === 'folder' ? '选择文件夹（合集）' : '选择媒体文件'}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">✕</button>
        </div>

        <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
          <HardDrive className="h-3.5 w-3.5" />
          <span className="truncate font-mono">{currentPath ?? '（选择盘符）'}</span>
        </div>

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
              <button
                onClick={() => setCurrentPath(data?.parent ?? null)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-zinc-300 hover:bg-white/5"
              >
                <FolderUp className="h-4 w-4 text-amber-400" /> ..（上级目录）
              </button>
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
                    onPick(f.path);
                    onClose();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-zinc-200 hover:bg-white/5"
                >
                  {f.kind === 'video' ? (
                    <Video className="h-4 w-4 text-indigo-400" />
                  ) : (
                    <Music className="h-4 w-4 text-emerald-400" />
                  )}
                  <span className="flex-1 truncate">{f.name}</span>
                  <Badge variant="outline" className="shrink-0">{f.kind}</Badge>
                </button>
              ))}
              {isFetching && <div className="px-4 py-3 text-xs text-zinc-500">加载中...</div>}
              {(data?.dirs ?? []).length === 0 && (data?.files ?? []).length === 0 && !isFetching && (
                <div className="px-4 py-6 text-center text-xs text-zinc-500">该目录下没有子目录或媒体文件</div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-zinc-500">
            {pickMode === 'folder'
              ? '进入目标文件夹后点击「选择当前文件夹」作为合集来源'
              : '点击具体文件回填路径'}
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
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(childTvApi.getChildTvToken());
  const [loginName, setLoginName] = useState('admin');
  const [loginPwd, setLoginPwd] = useState('');
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [selectedPlayId, setSelectedPlayId] = useState('');
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseMode, setBrowseMode] = useState<'folder' | 'file'>('folder');
  const [lockMinutes, setLockMinutes] = useState(240);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['child-tv'] });
  }, [queryClient]);

  const { data: auth } = useQuery({
    queryKey: ['child-tv-me', token],
    queryFn: childTvApi.childTvMe,
    enabled: !!token,
  });

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

  // ===== 时段 CRUD =====
  const saveMutation = useMutation({
    mutationFn: (dto: ChildTvScheduleInput) =>
      form.id
        ? childTvApi.childTvUpdateSchedule(form.id, dto)
        : childTvApi.childTvCreateSchedule(dto),
    onSuccess: () => {
      toast.success(form.id ? '时段已更新' : '时段已创建');
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['child-tv-schedules'] });
    },
    onError: (e) => {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
        '保存失败';
      toast.error(typeof msg === 'string' ? msg : '保存失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => childTvApi.childTvDeleteSchedule(id),
    onSuccess: () => {
      toast.success('时段已删除');
      queryClient.invalidateQueries({ queryKey: ['child-tv-schedules'] });
    },
  });

  const handleSave = () => {
    if (!form.name.trim()) return toast.error('请输入时段名称');
    if (!form.source.trim()) return toast.error('请选择或填写内容来源');
    saveMutation.mutate({
      name: form.name,
      start: form.start,
      durationMinutes: Number(form.durationMinutes),
      sourceType: form.sourceType,
      source: form.source,
      mediaType: form.mediaType,
      enabled: form.enabled,
    });
  };

  const startEdit = (s: ChildTvSchedule) => {
    setForm({
      id: s.id,
      name: s.name,
      start: s.start,
      durationMinutes: s.durationMinutes,
      sourceType: s.sourceType,
      source: s.source,
      mediaType: s.mediaType,
      enabled: s.enabled,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ===== 控制 =====
  const playMutation = useMutation({
    mutationFn: (id: string) => childTvApi.childTvPlay(id),
    onSuccess: (s) => {
      toast.success(`正在播放：${s.currentTitle || '内容'}`);
      refresh();
    },
    onError: (e) => {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
        '播放失败';
      toast.error(typeof msg === 'string' ? msg : '播放失败');
    },
  });

  const stopMutation = useMutation({
    mutationFn: childTvApi.childTvStop,
    onSuccess: () => {
      toast.success('已停止播放');
      refresh();
    },
  });

  const lockMutation = useMutation({
    mutationFn: (minutes: number) => childTvApi.childTvLock(minutes),
    onSuccess: () => {
      toast.success('已锁定电脑（键鼠失效）');
      refresh();
    },
    onError: (e) => {
      const msg =
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
        '锁定失败';
      toast.error(typeof msg === 'string' ? msg : '锁定失败');
    },
  });

  const unlockMutation = useMutation({
    mutationFn: childTvApi.childTvUnlock,
    onSuccess: () => {
      toast.success('已解锁');
      refresh();
    },
  });

  // ===== 设置 =====
  const [pwd1, setPwd1] = useState('');
  const [pin, setPin] = useState('');
  const [mpvPath, setMpvPath] = useState('');

  useEffect(() => {
    if (settings) {
      setMpvPath(settings.mpvPath || '');
      setLockMinutes(settings.defaultLockMinutes);
    }
  }, [settings]);

  const settingsMutation = useMutation({
    mutationFn: () =>
      childTvApi.childTvUpdateSettings({
        defaultLockMinutes: lockMinutes,
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
              <p className="text-center text-xs text-zinc-500">默认账号 admin / 123456</p>
            </div>
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

      {!status?.admin && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          服务未以管理员身份运行，锁定电脑功能将弹出 UAC 授权（其他功能不受影响）。
        </div>
      )}

      {/* 实时状态 + 远程控制 */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
            <MonitorPlay className="h-4 w-4 text-indigo-400" /> 实时状态
          </h3>
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
              <span className="text-zinc-400">电脑锁定</span>
              {status?.locked ? (
                <Badge className="bg-rose-500/20 text-rose-300">
                  已锁定{status.lockReason === 'manual' ? '（手动）' : '（随播放）'}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-zinc-400">未锁定</Badge>
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
                      {s.name}（{s.start} · {s.sourceType === 'folder' ? '合集' : s.sourceType === 'file' ? '单文件' : 'URL'}）
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

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => stopMutation.mutate()}
                disabled={!status?.playing || stopMutation.isPending}
              >
                <MonitorStop className="mr-1 h-3.5 w-3.5" /> 停止播放
              </Button>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={lockMinutes}
                  onChange={(e) => setLockMinutes(Number(e.target.value))}
                  title="锁定时长（分钟）"
                  className="w-20 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-center text-sm text-zinc-100 outline-none focus:border-rose-400/60"
                />
                <Button
                  variant="outline"
                  className="flex-1 border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
                  onClick={() => lockMutation.mutate(lockMinutes)}
                  disabled={status?.locked || lockMutation.isPending}
                >
                  <Lock className="mr-1 h-3.5 w-3.5" /> 锁定电脑
                </Button>
              </div>
            </div>

            <Button
              variant="ghost"
              className="w-full border-emerald-400/20 text-emerald-300 hover:bg-emerald-400/10"
              onClick={() => unlockMutation.mutate()}
              disabled={!status?.locked}
            >
              <LockOpen className="mr-1 h-3.5 w-3.5" /> 解锁电脑
            </Button>

            <p className="text-[11px] leading-relaxed text-zinc-500">
              锁定后键鼠失效（屏幕保持），最长锁定时长自动解锁；Ctrl+Alt+Del 始终可用；重启服务即解锁。
            </p>
          </div>
        </Card>
      </div>

      {/* 时段管理表单 */}
      <Card className="mb-6 p-6">
        <h3 className="mb-4 text-sm font-medium text-zinc-300">
          {editing ? `编辑时段：${form.name}` : '新增时段'}
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <input
              type="time"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/60"
            />
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
            <label className="mb-1 block text-xs text-zinc-400">内容来源</label>
            <select
              value={form.sourceType}
              onChange={(e) => setForm({ ...form, sourceType: e.target.value as 'folder' | 'file' | 'url' })}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none"
            >
              <option value="folder">合集（文件夹）</option>
              <option value="file">单文件</option>
              <option value="url">URL 链接</option>
            </select>
          </div>
          <div className="flex items-end">
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
          <label className="mb-1 block text-xs text-zinc-400">
            {form.sourceType === 'url'
              ? '视频 / 音频直链（http/https）'
              : form.sourceType === 'file'
                ? '媒体文件路径'
                : '文件夹路径（自动扫描全部音视频按文件名排序循环播放）'}
          </label>
          <div className="flex gap-2">
            <input
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder={
                form.sourceType === 'url'
                  ? 'https://example.com/video.mp4'
                  : form.sourceType === 'file'
                    ? 'C:\\Videos\\episode01.mp4'
                    : 'D:\\儿童内容\\纪录片'
              }
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-indigo-400/60"
            />
            {form.sourceType !== 'url' && (
              <Button
                variant="outline"
                onClick={() => {
                  setBrowseMode(form.sourceType as 'folder' | 'file');
                  setBrowseOpen(true);
                }}
              >
                <FolderOpen className="mr-1 h-3.5 w-3.5" /> 浏览…
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {editing ? '保存修改' : '创建时段'}
          </Button>
          {editing && (
            <Button variant="ghost" onClick={() => setForm(EMPTY_FORM)}>
              取消编辑
            </Button>
          )}
        </div>
      </Card>

      {/* 时段列表 */}
      <Card className="mb-6 overflow-hidden">
        <div className="border-b border-white/5 px-6 py-4">
          <h3 className="text-sm font-medium text-zinc-300">时段列表</h3>
        </div>
        <div className="divide-y divide-white/5">
          {schedules.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-zinc-500">
              还没有时段，先在上方创建一个
            </div>
          )}
          {schedules.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
              <div className="min-w-[130px]">
                <div className="text-sm font-medium text-zinc-100">{s.name}</div>
                <div className="text-xs text-zinc-500">
                  {s.start} 起 · {s.durationMinutes} 分钟
                  {s.durationMinutes + (Number(s.start.split(':')[0]) * 60 + Number(s.start.split(':')[1])) > 1440 && (
                    <span className="ml-1 text-amber-400/80">(跨天)</span>
                  )}
                </div>
              </div>
              <Badge variant="outline" className={s.mediaType === 'video' ? 'text-indigo-300' : 'text-emerald-300'}>
                {s.mediaType === 'video' ? '视频' : '音频'}
              </Badge>
              <Badge variant="outline" className="text-zinc-400">
                {s.sourceType === 'folder' ? '合集' : s.sourceType === 'file' ? '单文件' : 'URL'}
              </Badge>
              <div className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-500" title={s.source}>
                {s.source || '（未设置来源）'}
              </div>
              <Badge className={s.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-500/20 text-zinc-400'}>
                {s.enabled ? '启用' : '停用'}
              </Badge>
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

      {/* 日志 + 统计 */}
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

      {/* 设置 */}
      <Card className="mt-6 p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
          <SettingsIcon className="h-4 w-4 text-amber-400" /> 设置
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">mpv 可执行文件路径（留空自动检测）</label>
            <input
              value={mpvPath}
              onChange={(e) => setMpvPath(e.target.value)}
              placeholder="如 C:\Program Files\mpv\mpv.exe"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-indigo-400/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">默认锁定时长（分钟）</label>
            <input
              type="number"
              min={1}
              max={1440}
              value={lockMinutes}
              onChange={(e) => setLockMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none"
            />
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

      <BrowseDialog
        open={browseOpen}
        onClose={() => setBrowseOpen(false)}
        pickMode={browseMode}
        onPick={(p) => setForm((f) => ({ ...f, source: p }))}
      />
    </div>
  );
}

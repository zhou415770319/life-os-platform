import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Clock,
  Lock,
  LockOpen,
  MonitorPlay,
  Settings as SettingsIcon,
  Tv,
  UserRound,
  Wifi,
  WifiOff,
  X,
  LogOut,
} from 'lucide-react';
import { childTvApi } from '@client/src/api';

interface RemoteConfig {
  enabled: boolean;
  parentUrl: string;
  childUsername: string;
  bindCode: string;
}

const REMOTE_KEY = 'child_tv_remote_config';

function loadRemoteConfig(): RemoteConfig {
  try {
    const raw = localStorage.getItem(REMOTE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<RemoteConfig>;
      return {
        enabled: !!p.enabled,
        parentUrl: p.parentUrl ?? '',
        childUsername: p.childUsername ?? '',
        bindCode: p.bindCode ?? '',
      };
    }
  } catch {
    /* ignore */
  }
  return { enabled: false, parentUrl: '', childUsername: '', bindCode: '' };
}

function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function nextCountdownText(startsInMinutes: number, now: Date): string {
  const target = new Date(now.getTime() + startsInMinutes * 60_000);
  const day = target.getDate() !== now.getDate() ? '明天 ' : '';
  return `${day}${formatClock(target)}`;
}

export default function ChildTvWatchPage() {
  const [pinMode, setPinMode] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [authed, setAuthed] = useState(false);
  const clockRef = useRef<HTMLSpanElement>(null);
  const nowRef = useRef(new Date());

  // ===== 配置抽屉 + 儿童登录 =====
  const [configOpen, setConfigOpen] = useState(false);
  const [remote, setRemote] = useState<RemoteConfig>(loadRemoteConfig);
  const [loginUser, setLoginUser] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [logining, setLogining] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);

  // 时钟只更新文本节点，避免每秒全量重渲染
  useEffect(() => {
    const t = setInterval(() => {
      nowRef.current = new Date();
      if (clockRef.current) {
        clockRef.current.textContent = formatClock(nowRef.current);
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // 观看页免登录只读状态（含 PIN 开关，无需鉴权接口）
  const { data: status, isFetching } = useQuery({
    queryKey: ['child-tv-watch'],
    queryFn: childTvApi.childTvWatchStatus,
    refetchInterval: 5000,
  });

  const playing = status?.playing ?? false;
  const locked = status?.locked ?? false;
  const currentTitle = status?.currentTitle ?? '';
  const remaining = status?.remainingMinutes ?? null;
  const next = status?.nextSchedule ?? null;
  const pinEnabled = !!status?.pinEnabled;
  const now = nowRef.current;

  // 受控模式是否已正确配置（本机已有登录态或已登录儿童账号）
  const remoteActive = remote.enabled && !!remote.parentUrl && !!remote.childUsername && !!remote.bindCode;

  const showPin = pinEnabled && !authed && !loggedInUser && !pinMode;

  useEffect(() => {
    if (showPin && !pinMode) setPinMode(true);
  }, [showPin, pinMode]);

  const handlePinSubmit = async () => {
    try {
      const r = await childTvApi.childTvCheckPin(pinInput);
      if (r.ok) {
        setAuthed(true);
        setPinError(false);
      } else {
        setPinError(true);
        setPinInput('');
      }
    } catch {
      setPinError(true);
      setPinInput('');
    }
  };

  const handleLogin = async () => {
    if (!loginUser.trim() || !loginPwd) {
      toast.error('请输入儿童账号和密码');
      return;
    }
    setLogining(true);
    try {
      const r = await childTvApi.childTvLogin(loginUser.trim(), loginPwd);
      setLoggedInUser(r.username);
      setLoginPwd('');
      setAuthed(true);
      toast.success(`已登录儿童账号：${r.displayName || r.username}`);
    } catch {
      toast.error('登录失败，请检查账号密码');
    } finally {
      setLogining(false);
    }
  };

  const handleLogout = () => {
    childTvApi.childTvLogout();
    setLoggedInUser(null);
    setAuthed(false);
    toast.success('已退出登录');
  };

  const saveRemoteConfig = () => {
    setSavingCfg(true);
    try {
      localStorage.setItem(REMOTE_KEY, JSON.stringify(remote));
      toast.success(remote.enabled ? '受控模式已启用并保存' : '受控模式已关闭');
    } finally {
      setSavingCfg(false);
    }
  };

  // ===== PIN 拦截 =====
  if (showPin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl">
          <Tv className="mx-auto mb-4 h-10 w-10 text-indigo-400" />
          <h1 className="mb-4 text-lg font-semibold text-zinc-100">儿童播放器</h1>
          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value);
              setPinError(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
            placeholder="输入 PIN 码"
            autoFocus
            className="mb-3 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-lg tracking-widest text-zinc-100 outline-none focus:border-indigo-400/60"
          />
          {pinError && <p className="mb-2 text-xs text-rose-400">PIN 不正确，请重试</p>}
          <button
            onClick={handlePinSubmit}
            className="w-full rounded-lg bg-indigo-500 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
          >
            进入
          </button>
        </div>
      </div>
    );
  }

  // ===== 主界面：纯展示，无任何操作按钮 =====
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 p-6">
      {/* 氛围光晕 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />
        {playing && (
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500/5 blur-3xl" />
        )}
      </div>

      {/* 顶部时钟：ref 直更，不触发重渲染 */}
      <div className="absolute top-8 left-1/2 flex -translate-x-1/2 items-center gap-2 text-zinc-500">
        <Clock className="h-4 w-4" />
        <span ref={clockRef} className="font-mono text-lg">
          {formatClock(now)}
        </span>
      </div>

      {/* 受控模式连接状态（右上角，低对比） */}
      {remoteActive && (
        <div className="absolute top-8 right-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-zinc-400">
          {locked ? (
            <>
              <Lock className="h-3 w-3 text-rose-400" />
              <span className="text-rose-300">家长锁定中</span>
            </>
          ) : (
            <>
              <Wifi className="h-3 w-3 text-emerald-400" />
              <span>已连接家长端 · {remote.childUsername}</span>
            </>
          )}
        </div>
      )}

      {/* 设置入口（右上角，低对比） */}
      <button
        onClick={() => setConfigOpen(true)}
        title="设置 / 登录"
        className="absolute top-8 right-8 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-500 transition hover:bg-white/[0.08] hover:text-zinc-300"
      >
        <SettingsIcon className="h-4 w-4" />
      </button>

      {/* 主体 */}
      <div className="relative z-10 flex flex-col items-center text-center">
        {playing ? (
          <>
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-rose-500/30 to-purple-500/30">
              <MonitorPlay className="h-10 w-10 text-rose-300" />
            </div>
            <p className="mb-2 text-sm uppercase tracking-[0.3em] text-zinc-500">正在播放</p>
            <h1 className="mb-3 max-w-md text-3xl font-bold text-zinc-50">{currentTitle || '内容播放中'}</h1>
            {remaining !== null && (
              <p className="text-6xl font-black tabular-nums text-white">{remaining}</p>
            )}
            <p className="mt-2 text-sm text-zinc-400">分钟</p>
            {locked && (
              <div className="mt-8 flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-5 py-2 text-sm text-amber-300">
                <Lock className="h-4 w-4" /> 专心观看时间
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/[0.04]">
              <Tv className="h-10 w-10 text-indigo-400" />
            </div>
            <p className="mb-2 text-sm uppercase tracking-[0.3em] text-zinc-500">
              {locked ? '家长锁定中' : '下一时段'}
            </p>
            {locked && remoteActive ? (
              <>
                <h1 className="mb-3 text-3xl font-bold text-zinc-50">休息一下</h1>
                <p className="text-sm text-zinc-400">家长已锁定电脑，解锁后恢复</p>
              </>
            ) : next ? (
              <>
                <h1 className="mb-3 text-3xl font-bold text-zinc-50">{next.name}</h1>
                <p className="text-sm text-zinc-400">
                  {next.startLabel} 开始
                  {next.startsInMinutes > 0
                    ? `（${nextCountdownText(next.startsInMinutes, now)}）`
                    : ' · 即将开始'}
                </p>
              </>
            ) : (
              <h1 className="text-2xl text-zinc-500">今天没有安排了</h1>
            )}
            {isFetching && <p className="mt-6 text-xs text-zinc-600">同步中...</p>}
          </>
        )}
      </div>

      <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-zinc-700">
        儿童播放器 · 家长控制请使用控制台
      </p>

      {/* 配置抽屉：儿童登录 + 受控模式 */}
      {configOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/60"
          onClick={() => setConfigOpen(false)}
        >
          <div
            className="h-full w-full max-w-sm overflow-y-auto border-l border-white/10 bg-zinc-900/95 p-6 backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <SettingsIcon className="h-4 w-4 text-indigo-400" /> 儿童端设置
              </h2>
              <button onClick={() => setConfigOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 儿童账号登录 */}
            <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-300">
                <UserRound className="h-3.5 w-3.5 text-emerald-400" /> 儿童账号
              </h3>
              {loggedInUser ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-200">已登录：{loggedInUser}</span>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-rose-300"
                    >
                      <LogOut className="h-3 w-3" /> 退出
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                    placeholder="儿童账号（家长在控制台创建）"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/60"
                  />
                  <input
                    type="password"
                    value={loginPwd}
                    onChange={(e) => setLoginPwd(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    placeholder="密码"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/60"
                  />
                  <button
                    onClick={handleLogin}
                    disabled={logining}
                    className="w-full rounded-lg bg-emerald-500/90 py-2 text-sm font-medium text-white transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {logining ? '登录中...' : '登录'}
                  </button>
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    登录儿童账号后，家长控制台即可识别并远程锁定本机。
                  </p>
                </div>
              )}
            </div>

            {/* 受控模式配置 */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-300">
                {remoteActive ? (
                  <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-zinc-500" />
                )}
                受控模式（家长远程锁定）
              </h3>

              <label className="mb-3 flex cursor-pointer items-center justify-between text-sm text-zinc-300">
                <span>启用受控模式</span>
                <input
                  type="checkbox"
                  checked={remote.enabled}
                  onChange={(e) => setRemote({ ...remote, enabled: e.target.checked })}
                  className="h-4 w-4 accent-emerald-500"
                />
              </label>

              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">家长端服务地址（含端口）</label>
                  <input
                    value={remote.parentUrl}
                    onChange={(e) => setRemote({ ...remote, parentUrl: e.target.value })}
                    placeholder="http://192.168.1.10:3003"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-indigo-400/60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">本机儿童账号</label>
                  <input
                    value={remote.childUsername}
                    onChange={(e) => setRemote({ ...remote, childUsername: e.target.value })}
                    placeholder="家长创建并告知的儿童账号"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-indigo-400/60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">绑定码（家长控制台生成）</label>
                  <input
                    value={remote.bindCode}
                    onChange={(e) => setRemote({ ...remote, bindCode: e.target.value })}
                    placeholder="如 ABC123"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-indigo-400/60"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-[11px] text-zinc-500">
                  {remoteActive
                    ? `当前状态：${locked ? '已锁定' : '未锁定'} · 轮询同步中`
                    : '填齐三项后保存即可连接'}
                </p>
                <button
                  onClick={saveRemoteConfig}
                  disabled={savingCfg}
                  className="rounded-lg bg-indigo-500/90 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
                >
                  保存
                </button>
              </div>

              <p className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-zinc-500">
                启用后：家长在控制台对绑定儿童账号下发「锁定」时，本机 watch 状态会显示家长锁定中（锁键由服务端本机执行，请确认本服务与家长端可互通）。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  MonitorPlay,
  Tv,
  KeyRound,
  BookOpen,
} from 'lucide-react';
import { childTvApi } from '@client/src/api';
import UsageDocModal from '@client/src/components/ui/UsageDocModal';

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

  // ===== 使用说明（家长/儿童均可查看） =====
  const [usageOpen, setUsageOpen] = useState(false);
  const { data: usage } = useQuery({
    queryKey: ['child-tv-usage'],
    queryFn: childTvApi.childTvGetUsage,
    enabled: usageOpen,
  });

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
  // 低频轮询（30s）仅作状态对时，剩余分钟由前端基于 endsAt 本地倒计时，无需高频请求
  const { data: status, isFetching } = useQuery({
    queryKey: ['child-tv-watch'],
    queryFn: childTvApi.childTvWatchStatus,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // 本地倒计时：基于服务端 endsAt 每秒本地计算剩余分钟，接口不再高频调用
  const [localRemaining, setLocalRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      if (!status?.endsAt) {
        setLocalRemaining(status?.remainingMinutes ?? null);
        return;
      }
      const ends = Date.parse(status.endsAt);
      const rem = Math.max(0, Math.ceil((ends - Date.now()) / 60_000));
      setLocalRemaining(Number.isFinite(rem) ? rem : null);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [status?.endsAt, status?.remainingMinutes]);

  const playing = status?.playing ?? false;
  const currentTitle = status?.currentTitle ?? '';
  const remaining = localRemaining;
  const next = status?.nextSchedule ?? null;
  const pinEnabled = !!status?.pinEnabled;
  const now = nowRef.current;

  const showPin = pinEnabled && !authed && !pinMode;

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

  // ===== 主界面：纯展示，无任何操作按钮（儿童只能看） =====
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

      {/* 家长控制台入口（右上角，低对比） */}
      <Link
        to="/child-tv-admin"
        title="家长控制台（登录后管理时段与播放）"
        className="absolute top-8 right-8 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-500 transition hover:bg-white/[0.08] hover:text-zinc-300"
      >
        <KeyRound className="h-4 w-4" />
      </Link>

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
          </>
        ) : (
          <>
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/[0.04]">
              <Tv className="h-10 w-10 text-indigo-400" />
            </div>
            <p className="mb-2 text-sm uppercase tracking-[0.3em] text-zinc-500">下一时段</p>
            {next ? (
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

      {/* 使用说明入口（儿童也可查看，只读） */}
      <button
        onClick={() => setUsageOpen(true)}
        title="使用说明"
        className="absolute bottom-8 left-8 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-500 transition hover:bg-white/[0.08] hover:text-zinc-300"
      >
        <BookOpen className="h-4 w-4" />
      </button>

      {/* 使用说明弹窗 */}
      <UsageDocModal
        open={usageOpen}
        onClose={() => setUsageOpen(false)}
        title={usage?.title}
        content={usage?.content}
        footerNote="文档位置：user-data/plugins/dsh-plugin-child-tv/data/使用说明.md"
      />
    </div>
  );
}

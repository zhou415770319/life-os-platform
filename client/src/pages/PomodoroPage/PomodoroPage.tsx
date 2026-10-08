import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Play, Pause, RotateCcw, X, Timer, History, Trash2, Link2 } from 'lucide-react';
import { pomodoroApi } from '@client/src/api';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const PRESETS = [15, 25, 45, 60];

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PomodoroPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [preset, setPreset] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  // GTD 联动：从任务页跳转时通过 query 预填任务名并关联 taskId
  const [taskName, setTaskName] = useState(() => searchParams.get('title') ?? '');
  const [taskId, setTaskId] = useState<string | null>(() => searchParams.get('task'));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: records = [] } = useQuery({
    queryKey: ['pomodoro-records'],
    queryFn: pomodoroApi.getRecords,
  });

  const { data: stats } = useQuery({
    queryKey: ['pomodoro-stats'],
    queryFn: pomodoroApi.getStats,
  });

  const saveMutation = useMutation({
    mutationFn: (dto: {
      taskName?: string;
      durationMinutes: number;
      completedAt: string;
      abandoned?: boolean;
      taskId?: string;
    }) => pomodoroApi.createRecord(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pomodoro-records'] });
      queryClient.invalidateQueries({ queryKey: ['pomodoro-stats'] });
      queryClient.invalidateQueries({ queryKey: ['taskFocusStats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pomodoroApi.deleteRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pomodoro-records'] });
      queryClient.invalidateQueries({ queryKey: ['pomodoro-stats'] });
      toast.success('已删除');
    },
  });

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStart = () => {
    if (running) return;
    setRunning(true);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // 完成：保存记录
          stopTimer();
          setRunning(false);
          saveMutation.mutate({
            taskName,
            durationMinutes: preset,
            completedAt: new Date().toISOString(),
            taskId: taskId ?? undefined,
          });
          toast.success('番茄钟完成 🎉');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handlePause = () => {
    setRunning(false);
    stopTimer();
  };

  const handleReset = () => {
    setRunning(false);
    stopTimer();
    setSecondsLeft(preset * 60);
  };

  const handleAbandon = () => {
    if (running) {
      saveMutation.mutate({
        taskName,
        durationMinutes: preset,
        completedAt: new Date().toISOString(),
        abandoned: true,
        taskId: taskId ?? undefined,
      });
      toast.info('已记录放弃');
    }
    setRunning(false);
    stopTimer();
    setSecondsLeft(preset * 60);
  };

  const handlePreset = (m: number) => {
    setPreset(m);
    setSecondsLeft(m * 60);
    setRunning(false);
    stopTimer();
  };

  useEffect(() => stopTimer, [stopTimer]);

  const progress = useMemo(() => {
    const total = preset * 60;
    return total > 0 ? Math.round(((total - secondsLeft) / total) * 100) : 0;
  }, [secondsLeft, preset]);

  const totalMinutes = stats?.totalMinutes ?? 0;
  const todayMinutes = stats?.todayMinutes ?? 0;

  return (
    <div className="p-6 md:p-10 min-h-screen relative overflow-hidden">
      <BackgroundGlow variant="page" />
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">番茄钟记录</h1>
        <p className="text-sm text-zinc-400 mt-1">专注计时，记录每一次心流</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 计时器卡片 */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex flex-col items-center gap-6">
            <div className="relative w-56 h-56">
              <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                <circle
                  cx="100"
                  cy="100"
                  r="88"
                  fill="none"
                  stroke="url(#pomodoroGradient)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(progress / 100) * 2 * Math.PI * 88} ${2 * Math.PI * 88}`}
                />
                <defs>
                  <linearGradient id="pomodoroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f87171" />
                    <stop offset="100%" stopColor="#fb923c" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold tabular-nums text-zinc-50">
                  {formatTime(secondsLeft)}
                </span>
                <span className="mt-2 text-xs text-zinc-500">{running ? '专注中...' : '就绪'}</span>
              </div>
            </div>

            <div className="flex gap-2">
              {PRESETS.map((m) => (
                <Button
                  key={m}
                  variant={preset === m ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePreset(m)}
                >
                  {m} 分钟
                </Button>
              ))}
            </div>

            <input
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="本次专注任务（可选）"
              className="w-full max-w-sm rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
            {taskId && (
              <span className="inline-flex items-center gap-1.5 text-xs text-orange-300 bg-orange-500/10 border border-orange-400/30 rounded-full px-3 py-1">
                <Link2 className="w-3 h-3" />
                已关联任务，专注记录将计入该任务的统计
              </span>
            )}

            <div className="flex items-center gap-3">
              {!running ? (
                <Button onClick={handleStart} disabled={secondsLeft <= 0} className="gap-2">
                  <Play className="w-4 h-4" /> 开始
                </Button>
              ) : (
                <Button onClick={handlePause} variant="secondary" className="gap-2">
                  <Pause className="w-4 h-4" /> 暂停
                </Button>
              )}
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="w-4 h-4" /> 重置
              </Button>
              <Button variant="ghost" onClick={handleAbandon} className="gap-2 text-zinc-400">
                <X className="w-4 h-4" /> 放弃
              </Button>
            </div>
          </div>
        </Card>

        {/* 统计卡片 */}
        <Card className="p-6">
          <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-4">
            <Timer className="w-4 h-4 text-orange-400" /> 专注统计
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">今日专注</span>
              <span className="text-zinc-200 font-medium">{todayMinutes} 分钟</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">累计专注</span>
              <span className="text-zinc-200 font-medium">{totalMinutes} 分钟</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">完成次数</span>
              <span className="text-zinc-200 font-medium">{stats?.totalCount ?? 0} 次</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">专注完成率</span>
              <span className="text-zinc-200 font-medium">{stats?.focusRate ?? 100}%</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 历史记录 */}
      <Card className="mt-6 p-6">
        <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-4">
          <History className="w-4 h-4 text-indigo-400" /> 历史记录
        </h3>
        {records.length === 0 ? (
          <p className="text-sm text-zinc-500">还没有记录，开始你的第一个番茄钟吧</p>
        ) : (
          <div className="divide-y divide-white/5">
            {records.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={`w-2 h-2 rounded-full ${r.abandoned ? 'bg-zinc-500' : 'bg-emerald-400'}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-200 truncate">{r.taskName}</div>
                  <div className="text-xs text-zinc-500">
                    {new Date(r.completedAt).toLocaleString()} · {r.durationMinutes} 分钟
                    {r.abandoned && ' · 已放弃'}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}>
                  <Trash2 className="w-4 h-4 text-zinc-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

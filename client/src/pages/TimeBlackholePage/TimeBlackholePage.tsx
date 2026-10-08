import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Plus, Trash2, Hourglass } from 'lucide-react';
import { timeBlackholeApi } from '@client/src/api';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getTodayDateString } from '@client/src/utils/date';

const CATEGORIES = [
  { key: 'idle', label: '发呆', emoji: '😶', color: 'text-zinc-400' },
  { key: 'shortvideo', label: '刷短视频', emoji: '📱', color: 'text-rose-400' },
  { key: 'gossip', label: '八卦闲聊', emoji: '💬', color: 'text-amber-400' },
  { key: 'other', label: '其他', emoji: '🕳️', color: 'text-indigo-400' },
];

const QUICK_MINUTES = [5, 10, 15, 30];

export default function TimeBlackholePage() {
  const queryClient = useQueryClient();
  const today = getTodayDateString();
  const [category, setCategory] = useState('idle');
  const [note, setNote] = useState('');
  const [minutes, setMinutes] = useState(10);

  const { data: records = [] } = useQuery({
    queryKey: ['time-blackhole', today],
    queryFn: () => timeBlackholeApi.getRecords(today),
  });

  const { data: stats } = useQuery({
    queryKey: ['time-blackhole-stats'],
    queryFn: timeBlackholeApi.getStats,
  });

  const addMutation = useMutation({
    mutationFn: (dto: { category: string; note?: string; durationMinutes: number; recordDate: string }) =>
      timeBlackholeApi.createRecord(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-blackhole', today] });
      queryClient.invalidateQueries({ queryKey: ['time-blackhole-stats'] });
      setNote('');
      setMinutes(10);
      toast.success('已记录');
    },
    onError: () => toast.error('记录失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => timeBlackholeApi.deleteRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-blackhole', today] });
      queryClient.invalidateQueries({ queryKey: ['time-blackhole-stats'] });
      toast.success('已删除');
    },
  });

  const handleAdd = () => {
    if (minutes <= 0) {
      toast.error('请填写时长');
      return;
    }
    addMutation.mutate({ category, note, durationMinutes: minutes, recordDate: today });
  };

  const byCategory = stats?.byCategory ?? {};

  return (
    <div className="p-6 md:p-10 min-h-screen relative overflow-hidden">
      <BackgroundGlow variant="page" />
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-50">
          <AlertTriangle className="w-6 h-6 text-rose-400" /> 时间黑洞
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          诚实记录那些悄悄溜走的时间：发呆、刷短视频、八卦闲聊……
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 记录表单 */}
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-sm font-medium text-zinc-300 mb-4">记一笔时间浪费</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`rounded-lg border px-3 py-3 text-sm transition-all ${
                  category === c.key
                    ? 'border-rose-500/50 bg-rose-500/10 text-zinc-100'
                    : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20'
                }`}
              >
                <div className="text-xl mb-1">{c.emoji}</div>
                <div>{c.label}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs text-zinc-500">时长：</span>
            {QUICK_MINUTES.map((m) => (
              <Button
                key={m}
                size="sm"
                variant={minutes === m ? 'default' : 'outline'}
                onClick={() => setMinutes(m)}
              >
                {m} 分钟
              </Button>
            ))}
            <input
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-zinc-200"
            />
          </div>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="备注：比如'刷了半小时电商直播'"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 mb-4"
          />

          <Button onClick={handleAdd} className="gap-2">
            <Plus className="w-4 h-4" /> 记录
          </Button>
        </Card>

        {/* 今日统计 */}
        <Card className="p-6">
          <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-4">
            <Hourglass className="w-4 h-4 text-rose-400" /> 今日黑洞
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">今日浪费</span>
              <span className="text-rose-300 font-medium">{stats?.todayMinutes ?? 0} 分钟</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">今日记录</span>
              <span className="text-zinc-200 font-medium">{stats?.todayCount ?? 0} 笔</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">累计浪费</span>
              <span className="text-zinc-200 font-medium">{stats?.totalMinutes ?? 0} 分钟</span>
            </div>
            <div className="pt-2 border-t border-white/5">
              {CATEGORIES.map((c) => (
                <div key={c.key} className="flex justify-between py-1 text-xs">
                  <span className={`${c.color}`}>
                    {c.emoji} {c.label}
                  </span>
                  <span className="text-zinc-400">{byCategory[c.key] ?? 0} 分钟</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* 今日记录列表 */}
      <Card className="mt-6 p-6">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">今日记录</h3>
        {records.length === 0 ? (
          <p className="text-sm text-zinc-500">今天还没有浪费时间，继续保持 ✨</p>
        ) : (
          <div className="divide-y divide-white/5">
            {records.map((r) => {
              const cat = CATEGORIES.find((c) => c.key === r.category) ?? CATEGORIES[3];
              return (
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-lg">{cat.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-200">
                      {r.note || cat.label} · {r.durationMinutes} 分钟
                    </div>
                    <div className="text-xs text-zinc-500">
                      {new Date(r.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(r.id)}
                  >
                    <Trash2 className="w-4 h-4 text-zinc-500" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Flame,
  Timer,
  Hourglass,
  Target,
  Loader2,
  CalendarCheck2,
  TrendingUp,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getInsightsSummary, type InsightsSummary } from '@client/src/api/insights';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@client/src/components/ui/card';
import BackgroundGlow from '@client/src/components/ui/background-glow';

const BLACKHOLE_CATEGORY_LABEL: Record<string, string> = {
  idle: '发呆',
  shortvideo: '刷短视频',
  gossip: '八卦闲聊',
  other: '其他',
};

const BLACKHOLE_COLORS = ['#f43f5e', '#f97316', '#a78bfa', '#64748b'];

function formatMinutes(min: number): string {
  if (min < 60) return `${min} 分钟`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
}

const InsightsPage = () => {
  const [data, setData] = useState<InsightsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await getInsightsSummary();
      setData(summary);
    } catch (err) {
      logger.error('Load insights failed', String(err));
      toast.error('数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** 习惯热力图：近 91 天（13 周 × 7 天） */
  const heatmap = useMemo(() => {
    if (!data) return { weeks: [] as { day: number; date: string; count: number }[][], max: 0 };
    const days = data.habitHeatmap;
    const max = Math.max(1, ...days.map((d) => d.count));
    const weeks: { day: number; date: string; count: number }[][] = [];
    let current: { day: number; date: string; count: number }[] = [];
    for (const item of days) {
      const day = new Date(`${item.date}T00:00:00`).getDay();
      current.push({ day, date: item.date, count: item.count });
      if (day === 6) {
        weeks.push(current);
        current = [];
      }
    }
    if (current.length > 0) weeks.push(current);
    return { weeks, max };
  }, [data]);

  const heatColor = (count: number, max: number): string => {
    if (count === 0) return 'rgba(148,163,184,0.10)';
    const ratio = count / max;
    if (ratio > 0.75) return '#34d399';
    if (ratio > 0.5) return '#10b981';
    if (ratio > 0.25) return '#059669';
    return '#047857';
  };

  const activeGoals = data?.goalStats.filter((g) => g.status !== 'archived') ?? [];
  const avgProgress =
    activeGoals.length > 0
      ? Math.round(activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length)
      : 0;

  if (loading) {
    return (
      <div className="min-h-full p-6 md:p-10">
        <BackgroundGlow variant="page" />
        <div className="flex h-[60vh] items-center justify-center text-zinc-500 text-sm">
          <Loader2 className="w-5 h-5 mr-2 animate-spin text-indigo-400" />
          正在汇总数据...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 md:p-10">
      <BackgroundGlow variant="page" />

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-indigo-400" />
          数据洞察
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          汇总你的打卡、专注、时间与目标数据 — 用数据看见成长
        </p>
      </div>

      {/* 概览统计卡 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-2">
              <CalendarCheck2 className="w-3.5 h-3.5 text-emerald-400" />
              今日打卡
            </div>
            <div className="text-2xl font-semibold text-zinc-50">{data?.todayCheckIns ?? 0}</div>
            <div className="text-xs text-zinc-500 mt-1">次习惯完成</div>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-2">
              <Timer className="w-3.5 h-3.5 text-orange-400" />
              今日专注
            </div>
            <div className="text-2xl font-semibold text-zinc-50">
              {data && !data.pomodoroAnalysisEnabled ? '未开启' : formatMinutes(data?.pomodoroToday ?? 0)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {data && !data.pomodoroAnalysisEnabled
                ? '需在插件设置开启分析'
                : `累计 ${formatMinutes(data?.pomodoroTotal.minutes ?? 0)}`}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-2">
              <Hourglass className="w-3.5 h-3.5 text-rose-400" />
              今日浪费时间
            </div>
            <div className="text-2xl font-semibold text-zinc-50">
              {data && !data.blackholeAnalysisEnabled ? '未开启' : formatMinutes(data?.blackholeToday ?? 0)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {data && !data.blackholeAnalysisEnabled
                ? '需在插件设置开启分析'
                : `累计 ${formatMinutes(data?.blackholeTotal ?? 0)}`}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-2">
              <Target className="w-3.5 h-3.5 text-indigo-400" />
              目标平均进度
            </div>
            <div className="text-2xl font-semibold text-zinc-50">{avgProgress}%</div>
            <div className="text-xs text-zinc-500 mt-1">
              {activeGoals.length} 个进行中目标
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 习惯热力图（宽） */}
        <Card className="lg:col-span-3 bg-white/[0.03] backdrop-blur-xl border border-white/10">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              习惯打卡热力图
            </CardTitle>
            <CardDescription className="text-zinc-400">
              近 91 天每日完成打卡次数，颜色越深代表当天完成越多
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              <div className="flex gap-[3px]">
                {heatmap.weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {Array.from({ length: 7 }).map((_, di) => {
                      const cell = week.find((c) => c.day === di);
                      if (!cell) {
                        return <div key={di} className="w-3.5 h-3.5 rounded-[3px]" />;
                      }
                      return (
                        <div
                          key={di}
                          title={`${cell.date}：${cell.count} 次打卡`}
                          className="w-3.5 h-3.5 rounded-[3px] transition-colors"
                          style={{ backgroundColor: heatColor(cell.count, heatmap.max) }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-2 text-[11px] text-zinc-500">
                少
                {[0, 0.25, 0.5, 0.75, 1].map((r) => (
                  <span
                    key={r}
                    className="w-3 h-3 rounded-[3px]"
                    style={{
                      backgroundColor:
                        r === 0 ? 'rgba(148,163,184,0.10)' : heatColor(Math.max(1, Math.round(r * heatmap.max)), heatmap.max),
                    }}
                  />
                ))}
                多
              </div>
            </div>

            {data && data.habitStats.length > 0 && (
              <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-2">
                {data.habitStats.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 flex items-center gap-2"
                  >
                    <span className="text-base">{h.icon ?? '✅'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-300 truncate">{h.name}</p>
                      <p className="text-xs text-zinc-500">
                        累计 {h.totalCheckIns} 次 · 连续 {h.streakCount} 天
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 目标进度 */}
        <Card className="lg:col-span-2 bg-white/[0.03] backdrop-blur-xl border border-white/10">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-400" />
              目标进度
            </CardTitle>
            <CardDescription className="text-zinc-400">进行中目标的完成度</CardDescription>
          </CardHeader>
          <CardContent>
            {activeGoals.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                <Target className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                暂无进行中的目标
              </div>
            ) : (
              <div className="space-y-4">
                {activeGoals.map((g) => (
                  <div key={g.id} className="flex items-center gap-3">
                    <div className="relative w-14 h-14 shrink-0">
                      <svg viewBox="0 0 48 48" className="w-14 h-14 -rotate-90">
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          fill="none"
                          stroke="rgba(148,163,184,0.15)"
                          strokeWidth="5"
                        />
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          fill="none"
                          stroke={g.progress >= 100 ? '#34d399' : '#818cf8'}
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeDasharray={`${(g.progress / 100) * 2 * Math.PI * 20} ${2 * Math.PI * 20}`}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-zinc-200">
                        {g.progress}%
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-200 truncate">{g.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {g.category || '未分类'}
                        {g.status === 'completed' && ' · 已完成'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* 番茄钟 30 天 */}
        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
              <Timer className="w-4 h-4 text-orange-400" />
              番茄专注趋势
            </CardTitle>
            <CardDescription className="text-zinc-400">
              近 30 天每日专注分钟数 · 累计 {formatMinutes(data?.pomodoroTotal.minutes ?? 0)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data && !data.pomodoroAnalysisEnabled ? (
              <div className="py-10 text-center text-sm text-zinc-500">
                <Timer className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                番茄钟数据未开启分析
                <div className="mt-2 text-xs text-zinc-600">
                  到 <span className="text-indigo-400">系统设置 → 插件管理 → 番茄钟记录</span> 打开「参与数据分析」后显示
                </div>
              </div>
            ) : data && data.pomodoroTotal.minutes === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-500">
                <Timer className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                还没有专注记录，去番茄钟开始第一次专注吧
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data?.pomodoroDaily ?? []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#71717a', fontSize: 10 }}
                    tickFormatter={(v: string) => v.slice(5)}
                    axisLine={{ stroke: 'rgba(148,163,184,0.15)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#71717a', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      fontSize: 12,
                      color: '#e4e4e7',
                    }}
                    formatter={(value) => [`${value} 分钟`, '专注']}
                    labelFormatter={(label) => `日期：${label}`}
                  />
                  <Bar dataKey="minutes" fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 时间黑洞 30 天 */}
        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-rose-400" />
              时间黑洞趋势
            </CardTitle>
            <CardDescription className="text-zinc-400">
              近 30 天每日浪费时间 · 累计 {formatMinutes(data?.blackholeTotal ?? 0)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data && !data.blackholeAnalysisEnabled ? (
              <div className="py-10 text-center text-sm text-zinc-500">
                <Hourglass className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                时间黑洞数据未开启分析
                <div className="mt-2 text-xs text-zinc-600">
                  到 <span className="text-indigo-400">系统设置 → 插件管理 → 时间黑洞</span> 打开「参与数据分析」后显示
                </div>
              </div>
            ) : data && data.blackholeTotal === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-500">
                <Hourglass className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                还没有浪费时间记录，保持专注！
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data?.blackholeDaily ?? []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#71717a', fontSize: 10 }}
                    tickFormatter={(v: string) => v.slice(5)}
                    axisLine={{ stroke: 'rgba(148,163,184,0.15)' }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      fontSize: 12,
                      color: '#e4e4e7',
                    }}
                    formatter={(value) => [`${value} 分钟`, '浪费']}
                    labelFormatter={(label) => `日期：${label}`}
                  />
                  <Bar dataKey="minutes" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 时间黑洞分类占比 */}
      {data && data.blackholeByCategory.length > 0 && (
        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 mt-6">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              浪费时间构成
            </CardTitle>
            <CardDescription className="text-zinc-400">按类型统计浪费的时间占比</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.blackholeByCategory}
                    dataKey="minutes"
                    nameKey="category"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {data.blackholeByCategory.map((entry, idx) => (
                      <Cell key={entry.category} fill={BLACKHOLE_COLORS[idx % BLACKHOLE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      fontSize: 12,
                      color: '#e4e4e7',
                    }}
                    formatter={(value: number, name: string) => [
                      formatMinutes(value),
                      BLACKHOLE_CATEGORY_LABEL[name] ?? name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {data.blackholeByCategory.map((entry, idx) => (
                  <div
                    key={entry.category}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: BLACKHOLE_COLORS[idx % BLACKHOLE_COLORS.length] }}
                    />
                    <span className="text-sm text-zinc-300 flex-1">
                      {BLACKHOLE_CATEGORY_LABEL[entry.category] ?? entry.category}
                    </span>
                    <span className="text-sm text-zinc-400">{formatMinutes(entry.minutes)}</span>
                    <span className="text-xs text-zinc-500 w-12 text-right">
                      {data.blackholeTotal > 0
                        ? Math.round((entry.minutes / data.blackholeTotal) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 插件数据（需在插件设置中开启「参与数据分析」） */}
      {data && data.pluginStats && data.pluginStats.length > 0 && (
        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 mt-6">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              插件数据
            </CardTitle>
            <CardDescription className="text-zinc-400">
              已开启「参与数据分析」的插件（在系统设置 → 插件管理 → 插件详情中开启）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.pluginStats.map((p) => (
                <div
                  key={p.pluginKey}
                  className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4"
                >
                  <div className="text-sm font-semibold text-zinc-100">{p.name}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-indigo-300">{p.value}</span>
                    <span className="text-xs text-zinc-500">{p.label}</span>
                  </div>
                  {p.detail && <div className="mt-1 text-xs text-zinc-500">{p.detail}</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InsightsPage;

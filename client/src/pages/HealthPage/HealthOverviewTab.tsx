import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  Scale,
  Activity,
  Flame,
  Clock,
  Moon,
} from 'lucide-react';
import { Card, CardContent } from '@client/src/components/ui/card';
import type { HealthRecord, HealthSummary, HealthTrendPoint, HealthRecordType } from '@shared/api.interface';

const RECORD_TYPE_LABELS: Record<HealthRecordType, string> = {
  body: '身体数据',
  exercise: '运动记录',
  sleep: '睡眠追踪',
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

const recordTypeIcon = (type: string) => {
  if (type === 'body') return <Scale className="w-4 h-4 text-rose-400" />;
  if (type === 'exercise')
    return <Activity className="w-4 h-4 text-orange-400" />;
  return <Moon className="w-4 h-4 text-indigo-400" />;
};

const recordSummary = (record: HealthRecord): string => {
  const m = record.metrics;
  if (record.recordType === 'body') {
    const parts: string[] = [];
    if (m.weight) parts.push(`${m.weight}kg`);
    if (m.bodyFat) parts.push(`体脂${m.bodyFat}%`);
    if (m.heartRate) parts.push(`心率${m.heartRate}`);
    return parts.join(' · ') || '--';
  }
  if (record.recordType === 'exercise') {
    const parts: string[] = [];
    if (m.exerciseType) parts.push(m.exerciseType);
    if (m.durationMinutes) parts.push(`${m.durationMinutes}分钟`);
    if (m.calories) parts.push(`${m.calories}kcal`);
    return parts.join(' · ') || '--';
  }
  const parts: string[] = [];
  if (m.sleepHours) parts.push(`${m.sleepHours}h`);
  if (m.sleepQuality) parts.push(`${m.sleepQuality}星`);
  return parts.join(' · ') || '--';
};

interface HealthOverviewTabProps {
  summary: HealthSummary | undefined;
  summaryLoading: boolean;
  recentItems: HealthRecord[];
  recentLoading: boolean;
}

export default function HealthOverviewTab({
  summary,
  summaryLoading,
  recentItems,
  recentLoading,
}: HealthOverviewTabProps) {
  const weightTrend = summary?.weightTrend ?? [];

  const chartData = useMemo(() => {
    if (weightTrend.length === 0)
      return { points: [] as HealthTrendPoint[], min: 0, max: 100 };
    const values = weightTrend.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const pad = Math.max((rawMax - rawMin) * 0.2, 1);
    const min = Math.floor(rawMin - pad);
    const max = Math.ceil(rawMax + pad);
    return { points: weightTrend, min, max };
  }, [weightTrend]);

  return (
    <div className="space-y-6">
      {/* 核心指标卡 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-ai-section-type="card-stat">
        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center">
                <Scale className="w-4 h-4 text-rose-400" />
              </div>
              <span className="text-xs text-zinc-500">最新体重</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-zinc-50">
                {summaryLoading
                  ? '--'
                  : summary?.latestWeight
                    ? summary.latestWeight.toFixed(1)
                    : '--'}
              </span>
              <span className="text-sm text-zinc-500">kg</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center">
                <Activity className="w-4 h-4 text-orange-400" />
              </div>
              <span className="text-xs text-zinc-500">本周运动</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-zinc-50">
                {summaryLoading ? '--' : summary?.exerciseThisWeek ?? 0}
              </span>
              <span className="text-sm text-zinc-500">次</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Flame className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-xs text-zinc-500">本周消耗</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-zinc-50">
                {summaryLoading ? '--' : summary?.totalCaloriesThisWeek ?? 0}
              </span>
              <span className="text-sm text-zinc-500">kcal</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                <Clock className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="text-xs text-zinc-500">平均睡眠</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-zinc-50">
                {summaryLoading ? '--' : summary?.avgSleepHours.toFixed(1)}
              </span>
              <span className="text-sm text-zinc-500">小时</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 体重趋势图 + 最近记录 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-medium text-zinc-200">体重趋势</h3>
              <span className="text-xs text-zinc-500">近 7 天</span>
            </div>
            <div className="h-48 flex items-end gap-2">
              {summaryLoading || chartData.points.length === 0
                ? Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-white/5 rounded-t-md animate-pulse"
                      style={{ height: '30%' }}
                    />
                  ))
                : chartData.points.map((point, idx) => {
                    const range = chartData.max - chartData.min || 1;
                    const heightPct =
                      ((point.value - chartData.min) / range) * 100;
                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center gap-1.5"
                      >
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {point.value.toFixed(1)}
                        </span>
                        <div className="w-full flex-1 flex items-end">
                          <div
                            className="w-full rounded-t-md bg-gradient-to-t from-rose-500/20 to-orange-400/60 transition-all duration-500"
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500">
                          {formatDate(point.date)}
                        </span>
                      </div>
                    );
                  })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-200">最近记录</h3>
            </div>
            <div className="space-y-2">
              {recentLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] animate-pulse"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/10" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-white/10 rounded w-1/3" />
                        <div className="h-2.5 bg-white/5 rounded w-2/3" />
                      </div>
                    </div>
                  ))
                : recentItems.length === 0
                  ? (
                    <div className="text-center py-8 text-zinc-500 text-sm">
                      暂无记录，点击右上角开始记录
                    </div>
                  )
                  : recentItems.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                          {recordTypeIcon(record.recordType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-zinc-200 truncate">
                            {RECORD_TYPE_LABELS[record.recordType]}
                          </div>
                          <div className="text-xs text-zinc-500 truncate">
                            {recordSummary(record)}
                          </div>
                        </div>
                        <span className="text-xs text-zinc-600 shrink-0">
                          {formatDate(record.recordDate)}
                        </span>
                      </div>
                    ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

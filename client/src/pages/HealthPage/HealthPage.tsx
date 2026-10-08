import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Scale,
  Activity,
  Moon,
  HeartPulse,
  Plus,
  Star,
  Dumbbell,
  Footprints,
  Waves,
  Bike,
  Sparkles,
  Flame,
  Clock,
} from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@client/src/components/ui/tabs';
import { Card, CardContent } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import HealthOverviewTab from './HealthOverviewTab';
import HealthFormDialog from './HealthFormDialog';
import { getHealthRecords, getHealthSummary } from '@client/src/api/health';
import type { HealthRecordType, HealthRecord } from '@shared/api.interface';

const RECORD_TYPE_LABELS: Record<HealthRecordType, string> = {
  body: '身体数据',
  exercise: '运动记录',
  sleep: '睡眠追踪',
};

const INTENSITY_LABELS: Record<string, string> = {
  low: '低强度',
  medium: '中强度',
  high: '高强度',
};

const INTENSITY_COLORS: Record<string, string> = {
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  high: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

const exerciseIcon = (type: string): ReactNode => {
  const map: Record<string, ReactNode> = {
    跑步: <Footprints className="w-4 h-4" />,
    力量训练: <Dumbbell className="w-4 h-4" />,
    瑜伽: <Sparkles className="w-4 h-4" />,
    游泳: <Waves className="w-4 h-4" />,
    骑行: <Bike className="w-4 h-4" />,
  };
  return map[type] ?? <Activity className="w-4 h-4" />;
};

const renderStars = (quality: number) => {
  const q = Math.max(1, Math.min(5, quality));
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < q
              ? 'fill-amber-400 text-amber-400'
              : 'text-zinc-700 fill-transparent'
          }`}
        />
      ))}
    </div>
  );
};

const HealthPage = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [formType, setFormType] = useState<HealthRecordType>('body');
  const [formOpen, setFormOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['healthSummary', 7],
    queryFn: () => getHealthSummary(7),
  });

  const { data: recentRecords, isLoading: recentLoading } = useQuery({
    queryKey: ['healthRecords', { pageSize: 5, page: 1 }],
    queryFn: () => getHealthRecords({ pageSize: 5, page: 1 }),
  });

  const { data: bodyRecords, isLoading: bodyLoading } = useQuery({
    queryKey: ['healthRecords', { recordType: 'body', pageSize: 20, page: 1 }],
    queryFn: () =>
      getHealthRecords({ recordType: 'body', pageSize: 20, page: 1 }),
    enabled: activeTab === 'body',
  });

  const { data: exerciseRecords, isLoading: exerciseLoading } = useQuery({
    queryKey: [
      'healthRecords',
      { recordType: 'exercise', pageSize: 20, page: 1 },
    ],
    queryFn: () =>
      getHealthRecords({ recordType: 'exercise', pageSize: 20, page: 1 }),
    enabled: activeTab === 'exercise',
  });

  const { data: sleepRecords, isLoading: sleepLoading } = useQuery({
    queryKey: ['healthRecords', { recordType: 'sleep', pageSize: 20, page: 1 }],
    queryFn: () =>
      getHealthRecords({ recordType: 'sleep', pageSize: 20, page: 1 }),
    enabled: activeTab === 'sleep',
  });

  const openForm = (type: HealthRecordType) => {
    setFormType(type);
    setFormOpen(true);
  };

  return (
    <div className="min-h-full p-6 md:p-10">
      <BackgroundGlow variant="page" />

      {/* 顶部标题区 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            健康管理
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            记录身体数据、运动与睡眠，追踪你的健康趋势
          </p>
        </div>
        <Button
          onClick={() => openForm('body')}
          className="bg-gradient-to-r from-rose-500 to-orange-500 text-white border-0 hover:opacity-90"
          data-ai-section-type="button"
        >
          <Plus className="w-4 h-4" />
          记录健康数据
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="bg-white/[0.03] border border-white/5 p-1 flex-wrap h-auto">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-400"
          >
            <HeartPulse className="w-4 h-4 mr-1.5" />
            概览
          </TabsTrigger>
          <TabsTrigger
            value="body"
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-400"
          >
            <Scale className="w-4 h-4 mr-1.5" />
            身体数据
          </TabsTrigger>
          <TabsTrigger
            value="exercise"
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-400"
          >
            <Activity className="w-4 h-4 mr-1.5" />
            运动记录
          </TabsTrigger>
          <TabsTrigger
            value="sleep"
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-400"
          >
            <Moon className="w-4 h-4 mr-1.5" />
            睡眠追踪
          </TabsTrigger>
        </TabsList>

        {/* 概览 Tab */}
        <TabsContent value="overview" className="mt-6">
          <HealthOverviewTab
            summary={summary}
            summaryLoading={summaryLoading}
            recentItems={recentRecords?.items ?? []}
            recentLoading={recentLoading}
          />
        </TabsContent>

        {/* 身体数据 Tab */}
        <TabsContent value="body" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-200">身体数据记录</h3>
            <Button
              onClick={() => openForm('body')}
              size="sm"
              className="bg-gradient-to-r from-rose-500 to-orange-500 text-white border-0 hover:opacity-90"
              data-ai-section-type="button"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              记录身体数据
            </Button>
          </div>
          <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl">
            <CardContent className="p-0">
              {bodyLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-12 bg-white/5 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : (bodyRecords?.items ?? []).length === 0 ? (
                <div className="text-center py-16 text-zinc-500 text-sm">
                  暂无身体数据记录
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {(bodyRecords?.items ?? []).map((record) => {
                    const m = record.metrics;
                    return (
                      <div
                        key={record.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3 sm:w-36 shrink-0">
                          <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center">
                            <Scale className="w-4 h-4 text-rose-400" />
                          </div>
                          <span className="text-sm text-zinc-200 font-medium">
                            {formatDate(record.recordDate)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                          <div>
                            <span className="text-zinc-500 text-xs">体重 </span>
                            <span className="text-zinc-200">
                              {m.weight ? `${m.weight} kg` : '--'}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 text-xs">体脂率 </span>
                            <span className="text-zinc-200">
                              {m.bodyFat ? `${m.bodyFat}%` : '--'}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 text-xs">心率 </span>
                            <span className="text-zinc-200">
                              {m.heartRate ?? '--'}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 text-xs">血压 </span>
                            <span className="text-zinc-200">
                              {m.bloodPressureSystolic && m.bloodPressureDiastolic
                                ? `${m.bloodPressureSystolic}/${m.bloodPressureDiastolic}`
                                : '--'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 运动记录 Tab */}
        <TabsContent value="exercise" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-200">运动记录</h3>
            <Button
              onClick={() => openForm('exercise')}
              size="sm"
              className="bg-gradient-to-r from-rose-500 to-orange-500 text-white border-0 hover:opacity-90"
              data-ai-section-type="button"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              记录运动
            </Button>
          </div>
          <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl">
            <CardContent className="p-0">
              {exerciseLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-12 bg-white/5 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : (exerciseRecords?.items ?? []).length === 0 ? (
                <div className="text-center py-16 text-zinc-500 text-sm">
                  暂无运动记录
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {(exerciseRecords?.items ?? []).map((record) => {
                    const m = record.metrics;
                    return (
                      <div
                        key={record.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3 sm:w-48 shrink-0">
                          <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-400">
                            {exerciseIcon(m.exerciseType ?? '')}
                          </div>
                          <div>
                            <div className="text-sm text-zinc-200 font-medium">
                              {m.exerciseType ?? '运动'}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {formatDate(record.recordDate)}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm flex-1">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="text-zinc-200">
                              {m.durationMinutes ?? '--'} 分钟
                            </span>
                          </div>
                          {m.intensity && (
                            <span
                              className={`px-2 py-0.5 text-xs rounded-md border ${
                                INTENSITY_COLORS[m.intensity] ??
                                'bg-white/5 text-zinc-400 border-white/10'
                              }`}
                            >
                              {INTENSITY_LABELS[m.intensity] ?? m.intensity}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 sm:ml-auto">
                            <Flame className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-zinc-200">
                              {m.calories ?? '--'} kcal
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 睡眠追踪 Tab */}
        <TabsContent value="sleep" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-200">睡眠追踪</h3>
            <Button
              onClick={() => openForm('sleep')}
              size="sm"
              className="bg-gradient-to-r from-rose-500 to-orange-500 text-white border-0 hover:opacity-90"
              data-ai-section-type="button"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              记录睡眠
            </Button>
          </div>
          <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl">
            <CardContent className="p-0">
              {sleepLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-12 bg-white/5 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : (sleepRecords?.items ?? []).length === 0 ? (
                <div className="text-center py-16 text-zinc-500 text-sm">
                  暂无睡眠记录
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {(sleepRecords?.items ?? []).map((record) => {
                    const m = record.metrics;
                    return (
                      <div
                        key={record.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3 sm:w-48 shrink-0">
                          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                            <Moon className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div>
                            <div className="text-sm text-zinc-200 font-medium">
                              {formatDate(record.recordDate)}
                            </div>
                            <div className="text-xs text-zinc-500">睡眠</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-6 text-sm flex-1">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="text-zinc-200">
                              {m.sleepHours ?? '--'} 小时
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-500 text-xs">质量</span>
                            {m.sleepQuality
                              ? renderStars(m.sleepQuality)
                              : <span className="text-zinc-500">--</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <HealthFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        recordType={formType}
      />
    </div>
  );
};

export default HealthPage;

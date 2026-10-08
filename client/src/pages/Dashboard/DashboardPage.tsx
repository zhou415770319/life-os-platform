import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Target, Clock, Brain, Puzzle, Sparkles, type LucideIcon, AlertTriangle } from 'lucide-react';
import { Badge } from '@client/src/components/ui/badge';
import { Card } from '@client/src/components/ui/card';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Progress } from '@client/src/components/ui/progress';
import { dashboardApi } from '@client/src/api';
import { usePlugins } from '@client/src/hooks/use-plugins';
import { getPluginIcon } from '@client/src/utils/plugin-icons';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import type { DashboardStats, PluginConfig } from '@shared/api.interface';

function CoreCardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

function PluginCardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-5 space-y-3">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}

interface CoreCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  statusText: string;
  badgeText: string;
  gradientFrom: string;
  gradientTo: string;
  badgeClass: string;
  progress?: number;
  onClick: () => void;
}

function CoreCard({
  icon: Icon,
  title,
  description,
  statusText,
  badgeText,
  gradientFrom,
  gradientTo,
  badgeClass,
  progress,
  onClick,
}: CoreCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden glass-card glass-card-hover rounded-xl p-6 text-left transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-2xl w-full"
    >
      <div
        className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full blur-2xl opacity-20 transition-opacity duration-300 group-hover:opacity-40"
        style={{
          background: `radial-gradient(circle, ${gradientFrom}, transparent 70%)`,
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-16 h-44 w-44 rounded-full blur-2xl opacity-10 transition-opacity duration-300 group-hover:opacity-30"
        style={{
          background: `radial-gradient(circle, ${gradientTo}, transparent 70%)`,
        }}
      />

      <div className="relative flex flex-col space-y-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
          }}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-zinc-50">{title}</h3>
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        </div>

        <div className="space-y-2">
          {progress !== undefined ? (
            <>
              <div className="flex justify-between text-xs text-zinc-400">
                <span>{statusText}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </>
          ) : (
            <p className="text-sm font-medium text-zinc-300">{statusText}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Badge className={badgeClass}>{badgeText}</Badge>
        </div>
      </div>
    </button>
  );
}

interface PluginCardProps {
  plugin: PluginConfig;
  onClick: () => void;
}

function PluginCard({ plugin, onClick }: PluginCardProps) {
  const Icon = getPluginIcon(plugin.config.cardIcon);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden glass-card glass-card-hover rounded-xl p-5 text-left transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-xl w-full"
    >
      <div
        className="pointer-events-none absolute -top-16 -right-10 h-32 w-32 rounded-full blur-2xl opacity-15 transition-opacity duration-300 group-hover:opacity-30"
        style={{
          background: `radial-gradient(circle, ${plugin.config.gradientFrom}, transparent 70%)`,
        }}
      />
      <div className="relative flex flex-col space-y-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${plugin.config.gradientFrom}, ${plugin.config.gradientTo})`,
          }}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-50">
            {plugin.config.cardTitle}
          </h4>
          <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
            {plugin.config.cardDescription}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { enabledPlugins, error: pluginError, refresh: refreshPlugins } = usePlugins();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      try {
        return await dashboardApi.getDashboardStats();
      } catch (err: unknown) {
        logger.error('Failed to fetch dashboard stats', JSON.stringify(err));
        toast.error('加载看板数据失败');
        throw err;
      }
    },
  });

  const enabledCount = enabledPlugins.length;

  return (
    <div className="relative min-h-screen p-6 md:p-10">
      <BackgroundGlow variant="page" />

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
            Life-OS 终身成长看板
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            一切皆插件。基于 DSH 规范的模块化个人核心运行时。
          </p>
        </div>
        <Badge
          variant="outline"
          className="self-start md:self-auto gap-2 px-3 py-1.5"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-breathe absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-zinc-300">Core Kernel v1.0.0</span>
        </Badge>
      </header>

      {/* Core dashboard cards */}
      <section className="grid gap-6 md:grid-cols-3 mb-10">
        {statsLoading ? (
          <>
            <CoreCardSkeleton />
            <CoreCardSkeleton />
            <CoreCardSkeleton />
          </>
        ) : (
          <>
            <CoreCard
              icon={Target}
              title="人生愿景与长期 OKR"
              description="定义你今年的核心里程碑，保持航向清晰。"
              statusText={`${stats?.goals.active ?? 0} 个核心目标进行中`}
              badgeText={`共 ${stats?.goals.total ?? 0} 个目标`}
              gradientFrom="hsl(239, 84%, 67%)"
              gradientTo="hsl(270, 91%, 65%)"
              badgeClass="bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
              onClick={() => navigate('/goals')}
            />
            <CoreCard
              icon={Clock}
              title="能量与时间管理"
              description="管理每周高能时间段，记录习惯打卡与精力状态。"
              statusText="今日已打卡"
              badgeText={`${stats?.habits.todayCompleted ?? 0}/${stats?.habits.total ?? 0} 项`}
              gradientFrom="hsl(187, 92%, 60%)"
              gradientTo="hsl(200, 98%, 60%)"
              badgeClass="bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
              progress={stats?.habits.todayProgress ?? 0}
              onClick={() => navigate('/habits')}
            />
            <CoreCard
              icon={Brain}
              title="认知看板与闪念笔记"
              description="随时捕捉灵感，沉淀个人数字资产与核心原则。"
              statusText={`今日新增 ${stats?.notes.todayCount ?? 0} 条笔记`}
              badgeText={`共 ${stats?.notes.total ?? 0} 条`}
              gradientFrom="hsl(263, 83%, 66%)"
              gradientTo="hsl(322, 85%, 65%)"
              badgeClass="bg-violet-500/20 text-violet-300 border-violet-500/30"
              onClick={() => navigate('/notes')}
            />
          </>
        )}
      </section>

      {/* Plugin cards */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Puzzle className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-100">已装载插件</h2>
          <Badge variant="outline" className="ml-2">
            {enabledCount} 个
          </Badge>
        </div>

        {statsLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <PluginCardSkeleton />
            <PluginCardSkeleton />
            <PluginCardSkeleton />
          </div>
        ) : pluginError ? (
          <Card className="glass-card border-amber-500/20 bg-amber-500/5 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-200 mb-1">插件加载失败</p>
                <p className="text-xs text-amber-300/70 mb-3">
                  无法获取已装载的插件列表，插件卡片暂时无法展示。
                </p>
                <button
                  onClick={refreshPlugins}
                  className="text-xs text-amber-300 hover:text-amber-200 underline underline-offset-2"
                >
                  重新加载
                </button>
              </div>
            </div>
          </Card>
        ) : enabledCount === 0 ? (
          <Card className="glass-card border-dashed p-8 text-center">
            <Puzzle className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">
              暂无已装载插件，通过 AI 助手安装业务插件
            </p>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {enabledPlugins.map((plugin: PluginConfig) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                onClick={() => navigate(plugin.config.routePath)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Bottom status bar */}
      <footer className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Sparkles className="h-3.5 w-3.5" />
          <span>系统运行正常 · Core Kernel v1.0.0</span>
        </div>
        <div className="text-xs text-zinc-500">
          {enabledCount} 个插件已启用 /{' '}
          <span className="text-zinc-600">按需装载</span>
        </div>
      </footer>
    </div>
  );
}

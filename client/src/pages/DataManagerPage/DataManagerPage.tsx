import { useEffect, useState } from 'react';
import {
  Database,
  Cloud,
  BarChart3,
  Target,
  StickyNote,
  Repeat,
  Shield,
  Loader2,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { dataManagerApi } from '@client/src/api';
import type { DataExportResult } from '@shared/api.interface';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@client/src/components/ui/tooltip';
import ExportSection from './ExportSection';
import ImportSection from './ImportSection';

const DataManagerPage = () => {
  const [stats, setStats] = useState<DataExportResult | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const handleViewStats = async (showToast = false) => {
    setLoadingStats(true);
    try {
      const data = await dataManagerApi.exportAllData();
      setStats(data);
      if (showToast) toast.success('数据统计已刷新');
    } catch (err) {
      logger.error('Export all data failed', { error: String(err) });
      if (showToast) toast.error('加载数据统计失败');
    } finally {
      setLoadingStats(false);
    }
  };

  // 进入页面自动加载数据统计
  useEffect(() => {
    void handleViewStats(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefreshStats = async () => {
    if (!stats) return;
    try {
      const fresh = await dataManagerApi.exportAllData();
      setStats(fresh);
    } catch (err) {
      logger.error('Refresh stats failed', { error: String(err) });
    }
  };

  const statCards = [
    {
      label: '目标数量',
      value: stats?.goals.length ?? 0,
      icon: <Target className="w-5 h-5 text-indigo-400" />,
      gradient: 'from-indigo-500/20 to-purple-500/20 border-indigo-500/20',
    },
    {
      label: '笔记数量',
      value: stats?.notes.length ?? 0,
      icon: <StickyNote className="w-5 h-5 text-amber-400" />,
      gradient: 'from-amber-500/20 to-orange-500/20 border-amber-500/20',
    },
    {
      label: '习惯数量',
      value: stats?.habits.length ?? 0,
      icon: <Repeat className="w-5 h-5 text-emerald-400" />,
      gradient: 'from-emerald-500/20 to-cyan-500/20 border-emerald-500/20',
    },
    {
      label: '原则数量',
      value: stats?.principles.length ?? 0,
      icon: <Shield className="w-5 h-5 text-pink-400" />,
      gradient: 'from-pink-500/20 to-rose-500/20 border-pink-500/20',
    },
  ];

  const dataModules = stats
    ? [
        { name: '人生目标', count: stats.goals.length },
        { name: '习惯定义', count: stats.habits.length },
        { name: '打卡记录', count: stats.habitRecords.length },
        { name: '精力记录', count: stats.energyRecords.length },
        { name: '闪念笔记', count: stats.notes.length },
        { name: '人生原则', count: stats.principles.length },
        { name: '快速链接', count: stats.quickLinks.length },
        { name: '插件配置', count: stats.plugins.length },
      ]
    : [];

  return (
    <div className="min-h-full p-6 md:p-10">
      <BackgroundGlow variant="page" />

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          数据管理中心
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          数据备份、导出与云端同步
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-zinc-400" />
                数据概览
              </CardTitle>
              <CardDescription className="text-zinc-400">
                各模块数据条数统计
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {statCards.map((card) => (
                  <div
                    key={card.label}
                    className={`p-4 rounded-xl bg-gradient-to-br ${card.gradient} border`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {card.icon}
                      <span className="text-xs text-zinc-400">{card.label}</span>
                    </div>
                    <div className="text-2xl font-semibold text-zinc-50">
                      {card.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-zinc-500">
                <Database className="w-3.5 h-3.5" />
                数据来源：本地 JSON 文件存储（user-data/ 目录，支持后续迁移线上数据库）
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-zinc-400" />
                数据统计
              </CardTitle>
              <CardDescription className="text-zinc-400">
                各模块详细数据条数
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!stats && !loadingStats ? (
                <Button
                  variant="outline"
                  onClick={() => handleViewStats(true)}
                  className="w-full border-white/10 text-zinc-300 hover:text-white hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <BarChart3 className="w-4 h-4" />
                  查看数据统计
                </Button>
              ) : loadingStats && !stats ? (
                <div className="flex items-center justify-center py-6 text-zinc-500 text-sm">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  加载中...
                </div>
              ) : (
                <div className="space-y-2">
                  {dataModules.map((mod) => (
                    <div
                      key={mod.name}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5"
                    >
                      <span className="text-sm text-zinc-300">{mod.name}</span>
                      <Badge
                        variant="outline"
                        className="border-indigo-500/30 text-indigo-300 bg-indigo-500/10"
                      >
                        {mod.count} 条
                      </Badge>
                    </div>
                  ))}
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loadingStats}
                      onClick={() => handleViewStats(true)}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      <Loader2
                        className={`w-3.5 h-3.5 mr-1.5 ${loadingStats ? 'animate-spin' : ''}`}
                      />
                      刷新统计
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <ExportSection />
          <ImportSection onImportSuccess={handleRefreshStats} />

          <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-zinc-400" />
                云端同步
              </CardTitle>
              <CardDescription className="text-zinc-400">
                预留：将本地 JSON 数据迁移上传到线上数据库（后续版本开放）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-300">未配置云端数据库</span>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      variant="outline"
                      disabled
                      className="w-full border-white/10 text-zinc-500"
                    >
                      <Cloud className="w-4 h-4" />
                      配置云端同步
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">功能预留中，敬请期待</TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DataManagerPage;

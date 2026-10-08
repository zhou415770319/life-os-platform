import React from 'react';
import { Shield, Trash2, Clock, Loader2, Package, Pause, Play } from 'lucide-react';
import type { InstalledPlugin, PluginLifecycleStatus } from '@shared/api.interface';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { getPluginIcon } from '@client/src/utils/plugin-icons';
import { formatDate } from '@client/src/utils/date';

interface InstalledPluginsTabProps {
  plugins: InstalledPlugin[];
  loading: boolean;
  uninstallingKey: string | null;
  suspendingKey: string | null;
  getInstalledPlugin: (pluginKey: string) => InstalledPlugin | undefined;
  onUninstall: (plugin: InstalledPlugin) => void;
  onSuspend: (plugin: InstalledPlugin) => void;
  onResume: (plugin: InstalledPlugin) => void;
  installedCount: number;
}

const LIFECYCLE_LABELS: Record<PluginLifecycleStatus, string> = {
  discovered: '已发现',
  resolving: '解析中',
  loading: '加载中',
  active: '运行中',
  suspended: '已暂停',
  unloaded: '已卸载',
};

const LIFECYCLE_COLORS: Record<PluginLifecycleStatus, string> = {
  discovered: 'border-zinc-500/30 text-zinc-400 bg-zinc-500/10',
  resolving: 'border-blue-500/30 text-blue-300 bg-blue-500/10',
  loading: 'border-amber-500/30 text-amber-300 bg-amber-500/10',
  active: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
  suspended: 'border-orange-500/30 text-orange-300 bg-orange-500/10',
  unloaded: 'border-zinc-600/30 text-zinc-500 bg-zinc-600/10',
};

const InstalledPluginsTab: React.FC<InstalledPluginsTabProps> = ({
  plugins,
  loading,
  uninstallingKey,
  suspendingKey,
  getInstalledPlugin,
  onUninstall,
  onSuspend,
  onResume,
  installedCount,
}) => {
  return (
    <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
      <CardHeader>
        <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          已安装插件
        </CardTitle>
        <CardDescription className="text-zinc-400">
          管理已安装的插件，可卸载不需要的插件 · 当前已启用 {installedCount} 个
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            正在加载...
          </div>
        ) : plugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <Package className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">暂无已安装的插件</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plugins.map((plugin) => {
              const Icon = getPluginIcon(plugin.config.cardIcon);
              const isUninstalling = uninstallingKey === plugin.pluginKey;
              const isSuspending = suspendingKey === plugin.pluginKey;
              const installedInfo = getInstalledPlugin(plugin.pluginKey);
              const lifecycleStatus = plugin.lifecycleStatus || 'active';
              return (
                <div
                  key={plugin.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/15 transition-all duration-200"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${plugin.config.gradientFrom}33, ${plugin.config.gradientTo}33)`,
                    }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-zinc-50">{plugin.name}</h3>
                      <Badge
                        variant="outline"
                        className="text-xs border-white/10 text-zinc-400 bg-white/[0.02]"
                      >
                        v{plugin.version || '1.0.0'}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${LIFECYCLE_COLORS[lifecycleStatus]}`}
                      >
                        {LIFECYCLE_LABELS[lifecycleStatus]}
                      </Badge>
                      {plugin.isCore && (
                        <Badge
                          variant="outline"
                          className="text-xs border-indigo-500/30 text-indigo-300 bg-indigo-500/10"
                        >
                          核心
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-1">
                      {plugin.description}
                    </p>
                    {installedInfo?.installedAt && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-zinc-500">
                        <Clock className="w-3 h-3" />
                        安装时间：{formatDate(installedInfo.installedAt)}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {plugin.isCore ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="border-white/10 text-zinc-500"
                        title="核心插件不可操作"
                      >
                        <Shield className="w-3.5 h-3.5 mr-1" />
                        受保护
                      </Button>
                    ) : (
                      <>
                        {lifecycleStatus === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSuspend(plugin)}
                            disabled={isSuspending || isUninstalling}
                            className="border-amber-500/20 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 hover:border-amber-500/30"
                          >
                            {isSuspending ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                暂停中
                              </>
                            ) : (
                              <>
                                <Pause className="w-3.5 h-3.5 mr-1" />
                                暂停
                              </>
                            )}
                          </Button>
                        )}
                        {lifecycleStatus === 'suspended' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onResume(plugin)}
                            disabled={isSuspending || isUninstalling}
                            className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-500/30"
                          >
                            {isSuspending ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                恢复中
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 mr-1" />
                                恢复
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onUninstall(plugin)}
                          disabled={isUninstalling}
                          className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30"
                        >
                          {isUninstalling ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                              卸载中
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              卸载
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InstalledPluginsTab;

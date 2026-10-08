import { useState } from 'react';
import {
  Sparkles,
  Download,
  Check,
  Loader2,
  Package,
  Shield,
  Layers,
  Code2,
  Info,
} from 'lucide-react';
import type { AvailablePlugin, InstalledPlugin } from '@shared/api.interface';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@client/src/components/ui/tabs';
import { getPluginIcon } from '@client/src/utils/plugin-icons';
import PluginDetailDialog from './PluginDetailDialog';
import MechanismTab from '../../PluginCenterPage/MechanismTab';
import DevelopmentTab from '../../PluginCenterPage/DevelopmentTab';

const categoryLabels: Record<string, string> = {
  core: '核心模块',
  education: '教育学习',
  productivity: '效率工具',
  finance: '财务管理',
  lifestyle: '生活方式',
  health: '健康管理',
};

interface PluginCenterTabProps {
  plugins: AvailablePlugin[];
  installedPlugins: InstalledPlugin[];
  loading: boolean;
  installingKey: string | null;
  uninstallingKey: string | null;
  suspendingKey: string | null;
  onInstall: (plugin: AvailablePlugin) => void;
  onUninstall: (plugin: AvailablePlugin | InstalledPlugin) => void;
  onSuspend: (plugin: InstalledPlugin) => void;
  onResume: (plugin: InstalledPlugin) => void;
}

const PluginCenterTab: React.FC<PluginCenterTabProps> = ({
  plugins,
  installedPlugins,
  loading,
  installingKey,
  uninstallingKey,
  suspendingKey,
  onInstall,
  onUninstall,
  onSuspend,
  onResume,
}) => {
  const [detailPlugin, setDetailPlugin] = useState<AvailablePlugin | null>(null);

  const getInstalled = (pluginKey: string) =>
    installedPlugins.find((p) => p.pluginKey === pluginKey) ?? null;
  const isInstalled = (pluginKey: string) =>
    installedPlugins.some((p) => p.pluginKey === pluginKey && p.enabled);
  const isDisabled = (pluginKey: string) => {
    const p = installedPlugins.find((x) => x.pluginKey === pluginKey);
    return !!p && !p.enabled;
  };

  const installedCount = installedPlugins.filter((p) => p.enabled).length;

  return (
    <div className="space-y-6">
      {/* 统一插件市场：插件市场 + 已安装合并 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-400" />
            插件市场
          </CardTitle>
          <CardDescription className="text-zinc-400">
            共 {plugins.length} 个可用插件 · 已启用 {installedCount} 个 · 点击卡片查看详情与方法
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              正在加载插件列表...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plugins.map((plugin) => {
                const Icon = getPluginIcon(plugin.config.cardIcon);
                const installed = getInstalled(plugin.pluginKey);
                const enabled = isInstalled(plugin.pluginKey);
                const disabled = isDisabled(plugin.pluginKey);
                const busy =
                  installingKey === plugin.pluginKey ||
                  uninstallingKey === plugin.pluginKey ||
                  suspendingKey === plugin.pluginKey;

                return (
                  <div
                    key={plugin.pluginKey}
                    className={`group relative overflow-hidden rounded-xl border p-5 transition-all duration-200 cursor-pointer ${
                      enabled
                        ? 'border-emerald-500/30 bg-emerald-500/[0.04] hover:border-emerald-500/50'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                    }`}
                    onClick={() => setDetailPlugin(plugin)}
                  >
                    <div className="relative z-10">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${plugin.config.gradientFrom}, ${plugin.config.gradientTo})`,
                          }}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-zinc-50">
                              {plugin.name}
                            </span>
                            <span className="text-xs text-zinc-500">v{plugin.version}</span>
                            {plugin.isCore && (
                              <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs px-1.5">
                                核心
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                            {plugin.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                            <span className="px-1.5 py-0.5 rounded bg-white/5">
                              {categoryLabels[plugin.category] ?? plugin.category}
                            </span>
                            <span className="inline-flex items-center gap-1 text-indigo-300/80">
                              <Info className="w-3 h-3" /> 点击查看详情
                            </span>
                          </div>
                        </div>
                        {/* 状态与操作 */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {enabled ? (
                            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                              <Check className="w-3 h-3 mr-1" /> 已启用
                            </Badge>
                          ) : disabled ? (
                            <Badge variant="outline" className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">
                              已暂停
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-white/5 text-zinc-400 border-white/10">
                              未安装
                            </Badge>
                          )}
                          <div className="flex items-center gap-1.5">
                            {enabled || disabled ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  className="h-7 px-2 text-xs border-white/10 text-zinc-300 hover:text-white hover:border-white/25"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (disabled) onResume(installed!);
                                    else onSuspend(installed!);
                                  }}
                                >
                                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : disabled ? '启用' : '暂停'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy || plugin.isCore}
                                  className="h-7 px-2 text-xs border-white/10 text-rose-300 hover:text-rose-200 hover:border-rose-500/30"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUninstall(plugin);
                                  }}
                                >
                                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : '卸载'}
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                disabled={busy}
                                className="h-7 px-3 text-xs bg-gradient-to-r from-indigo-500 to-purple-600 border-0 text-white hover:opacity-90"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onInstall(plugin);
                                }}
                              >
                                {busy ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Download className="w-3 h-3 mr-1" />
                                )}
                                安装
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 机制与开发指南 */}
      <Tabs defaultValue="mechanism" className="w-full">
        <TabsList className="bg-white/[0.03] border border-white/10 p-1">
          <TabsTrigger value="mechanism" className="data-[state=active]:bg-white/10">
            <Layers className="w-4 h-4 mr-2" />
            插件机制
          </TabsTrigger>
          <TabsTrigger value="development" className="data-[state=active]:bg-white/10">
            <Code2 className="w-4 h-4 mr-2" />
            开发指南
          </TabsTrigger>
        </TabsList>
        <TabsContent value="mechanism">
          <MechanismTab />
        </TabsContent>
        <TabsContent value="development">
          <DevelopmentTab />
        </TabsContent>
      </Tabs>

      {detailPlugin && (
        <PluginDetailDialog
          plugin={detailPlugin}
          installed={getInstalled(detailPlugin.pluginKey)}
          onClose={() => setDetailPlugin(null)}
        />
      )}
    </div>
  );
};

export default PluginCenterTab;

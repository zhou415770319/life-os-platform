import { useState } from 'react';
import {
  Package,
  Check,
  Loader2,
  Layers,
  Code2,
  Info,
  Send,
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
import SubmitMarketDialog from './SubmitMarketDialog';
import MechanismTab from '../../PluginCenterPage/MechanismTab';
import DevelopmentTab from '../../PluginCenterPage/DevelopmentTab';
import Disclaimer from '@client/src/components/ui/disclaimer';

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
  /** 数据变更后刷新（市场安装/卸载后调用） */
  onDataChanged?: () => void;
}

/**
 * 插件中心：已安装插件的管理视图
 * （浏览与安装请前往「插件市场」Tab：内置插件 + 在线插件市场合并展示）
 */
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
  onDataChanged,
}) => {
  const [detailPlugin, setDetailPlugin] = useState<AvailablePlugin | null>(null);
  /** 提交市场确认弹框：可修改描述与版本号（版本号会同步写回本地 manifest.json） */
  const [submitTarget, setSubmitTarget] = useState<InstalledPlugin | null>(null);

  const getInstalled = (pluginKey: string) =>
    installedPlugins.find((p) => p.pluginKey === pluginKey) ?? null;
  const isInstalled = (pluginKey: string) =>
    installedPlugins.some((p) => p.pluginKey === pluginKey && p.enabled);
  const isDisabled = (pluginKey: string) => {
    const p = installedPlugins.find((x) => x.pluginKey === pluginKey);
    return !!p && !p.enabled;
  };

  const installedCount = installedPlugins.filter((p) => p.enabled).length;
  const marketInstalledCount = installedPlugins.filter(
    (p) => p.config?.source === 'market',
  ).length;

  // 已安装插件按安装时间降序
  const sortedInstalled = [...installedPlugins].sort((a, b) =>
    (b.installedAt || '').localeCompare(a.installedAt || ''),
  );

  /** 提交插件到市场：打开确认弹框（可修改描述/版本号），确认后唤起 AI 聊天框自动提交（AI 代办建分支 + PR） */
  const handleSubmitToMarket = (plugin: InstalledPlugin) => {
    setSubmitTarget(plugin);
  };

  return (
    <div className="space-y-6">
      {/* 已安装插件管理 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-400" />
            已安装插件
          </CardTitle>
          <CardDescription className="text-zinc-400">
            共 {installedPlugins.length} 个已安装（内置 {installedPlugins.length - marketInstalledCount} · 市场 {marketInstalledCount}）· 已启用 {installedCount} 个 · 点击卡片查看详情与方法
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              正在加载插件列表...
            </div>
          ) : sortedInstalled.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              暂无已安装插件，请前往「插件市场」Tab 浏览并安装
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedInstalled.map((installed) => {
                const plugin = plugins.find((p) => p.pluginKey === installed.pluginKey);
                const Icon = plugin ? getPluginIcon(plugin.config.cardIcon) : Package;
                const gradientFrom = plugin?.config?.gradientFrom || '#6366f1';
                const gradientTo = plugin?.config?.gradientTo || '#8b5cf6';
                const category = plugin?.category ?? 'other';
                const enabled = isInstalled(installed.pluginKey);
                const disabled = isDisabled(installed.pluginKey);
                const busy =
                  installingKey === installed.pluginKey ||
                  uninstallingKey === installed.pluginKey ||
                  suspendingKey === installed.pluginKey;
                const isCore = plugin?.isCore ?? installed.pluginKey === 'dsh-plugin-life-dashboard';
                const isMarketSource = installed.config?.source === 'market';

                const displayPlugin: AvailablePlugin | null = plugin ?? {
                  pluginKey: installed.pluginKey,
                  name: installed.name,
                  description: installed.description,
                  version: installed.version,
                  category,
                  isCore,
                  config: {
                    cardIcon: (installed.config?.cardIcon as string) || 'puzzle',
                    cardTitle: installed.name,
                    cardDescription: installed.description,
                    routePath: (installed.config?.routePath as string) || '/',
                    gradientFrom,
                    gradientTo,
                    source: installed.config?.source,
                  },
                };

                return (
                  <div
                    key={installed.pluginKey}
                    className={`group relative overflow-hidden rounded-xl border p-5 transition-all duration-200 cursor-pointer ${
                      enabled
                        ? 'border-emerald-500/30 bg-emerald-500/[0.04] hover:border-emerald-500/50'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                    }`}
                    onClick={() => setDetailPlugin(displayPlugin)}
                  >
                    <div className="relative z-10">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
                          }}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-zinc-50">
                              {installed.name}
                            </span>
                            <span className="text-xs text-zinc-500">v{installed.version}</span>
                            {isCore && (
                              <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs px-1.5">
                                核心
                              </Badge>
                            )}
                            {isMarketSource && (
                              <Badge variant="outline" className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs px-1.5">
                                在线
                              </Badge>
                            )}
                            {enabled && (
                              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-1.5">
                                <Check className="w-3 h-3 mr-0.5" /> 已启用
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                            {installed.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                            <span className="px-1.5 py-0.5 rounded bg-white/5">
                              {categoryLabels[category] ?? category}
                            </span>
                            {installed.installedAt && (
                              <span className="px-1.5 py-0.5 rounded bg-white/5">
                                安装于 {new Date(installed.installedAt).toLocaleDateString('zh-CN')}
                              </span>
                            )}
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
                          ) : (
                            <Badge variant="outline" className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">
                              已暂停
                            </Badge>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy || isCore}
                              className="h-7 px-2 text-xs border-white/10 text-indigo-300 hover:text-indigo-200 hover:border-indigo-500/40"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSubmitToMarket(installed);
                              }}
                            >
                              <Send className="w-3 h-3 mr-1" />
                              提交市场
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              className="h-7 px-2 text-xs border-white/10 text-zinc-300 hover:text-white hover:border-white/25"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (disabled) onResume(installed);
                                else onSuspend(installed);
                              }}
                            >
                              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : disabled ? '启用' : '暂停'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy || isCore}
                              className="h-7 px-2 text-xs border-white/10 text-rose-300 hover:text-rose-200 hover:border-rose-500/30"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUninstall(installed);
                              }}
                            >
                              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : '卸载'}
                            </Button>
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

      {/* 免责声明 */}
      <Disclaimer />

      {detailPlugin && (
        <PluginDetailDialog
          plugin={detailPlugin}
          installed={getInstalled(detailPlugin.pluginKey)}
          onClose={() => setDetailPlugin(null)}
        />
      )}

      {/* 提交市场确认弹框：描述/版本号可修改，版本号同步写回 manifest.json */}
      {submitTarget && (
        <SubmitMarketDialog plugin={submitTarget} onClose={() => setSubmitTarget(null)} />
      )}
    </div>
  );
};

export default PluginCenterTab;

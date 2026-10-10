import { useMemo, useState, useEffect, useCallback } from 'react';
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
  Globe,
  RefreshCw,
  Trash2,
  Send,
} from 'lucide-react';
import type { AvailablePlugin, InstalledPlugin, MarketPluginItem } from '@shared/api.interface';
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
import { marketApi } from '@client/src/api';
import { toast } from 'sonner';
import { showConfirm } from '@lark-apaas/client-toolkit';
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
  /** 数据变更后刷新（市场安装/卸载后调用） */
  onDataChanged?: () => void;
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
  onDataChanged,
}) => {
  const [detailPlugin, setDetailPlugin] = useState<AvailablePlugin | null>(null);
  const [marketItems, setMarketItems] = useState<MarketPluginItem[]>([]);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [marketBusyKey, setMarketBusyKey] = useState<string | null>(null);

  const refreshMarket = useCallback(async () => {
    setLoadingMarket(true);
    try {
      const data = await marketApi.getMarketPlugins();
      setMarketItems(data.items ?? []);
    } catch (err) {
      // 网络不可用时静默降级（内置插件区不受影响）
      setMarketItems([]);
    } finally {
      setLoadingMarket(false);
    }
  }, []);

  useEffect(() => {
    refreshMarket();
  }, [refreshMarket]);

  const getInstalled = (pluginKey: string) =>
    installedPlugins.find((p) => p.pluginKey === pluginKey) ?? null;
  const isInstalled = (pluginKey: string) =>
    installedPlugins.some((p) => p.pluginKey === pluginKey && p.enabled);
  const isDisabled = (pluginKey: string) => {
    const p = installedPlugins.find((x) => x.pluginKey === pluginKey);
    return !!p && !p.enabled;
  };

  const installedCount = installedPlugins.filter((p) => p.enabled).length;

  // 内置插件：过滤掉市场来源（市场插件在下方「在线插件市场」区块展示）
  const builtinPlugins = useMemo(
    () => plugins.filter((p) => p.config?.source !== 'market'),
    [plugins],
  );

  // 已安装插件按安装时间降序排最前，未安装保持原序在后
  const sortedPlugins = useMemo(() => {
    const installedMap = new Map(installedPlugins.map((p) => [p.pluginKey, p]));
    const installedList = builtinPlugins
      .filter((p) => installedMap.has(p.pluginKey))
      .sort((a, b) => {
        const at = installedMap.get(a.pluginKey)?.installedAt ?? '';
        const bt = installedMap.get(b.pluginKey)?.installedAt ?? '';
        return bt.localeCompare(at);
      });
    const notInstalledList = builtinPlugins.filter((p) => !installedMap.has(p.pluginKey));
    return [...installedList, ...notInstalledList];
  }, [builtinPlugins, installedPlugins]);

  const handleMarketAction = async (
    item: MarketPluginItem,
    action: 'install' | 'update' | 'uninstall',
  ) => {
    setMarketBusyKey(item.pluginKey);
    try {
      if (action === 'install') {
        await marketApi.marketInstall(item.pluginKey);
        toast.success(`已从市场安装「${item.name}」`);
      } else if (action === 'update') {
        await marketApi.marketUpdate(item.pluginKey);
        toast.success(`已更新「${item.name}」`);
      } else {
        await marketApi.marketUninstall(item.pluginKey);
        toast.success(`已卸载「${item.name}」（数据已保留）`);
      }
      await refreshMarket();
      onDataChanged?.();
      window.dispatchEvent(new CustomEvent('life-os:plugin-updated'));
    } catch (err: any) {
      const msg = err?.response?.data?.message || (action === 'uninstall' ? '卸载失败' : '操作失败');
      toast.error(msg);
    } finally {
      setMarketBusyKey(null);
    }
  };

  /** 提交插件到市场：唤起 AI 聊天框并自动发送提交指令（由 AI 代办建分支 + PR） */
  const handleSubmitToMarket = async (plugin: { pluginKey: string; name: string }) => {
    const ok = await showConfirm(
      `将「${plugin.name}」提交到 GitHub 插件市场？\n\n系统会唤起 AI 助手，自动新建分支并创建 Pull Request，由仓库管理员 review 审核后合并（不会自动合并）。`,
    );
    if (!ok) return;
    window.dispatchEvent(
      new CustomEvent('life-os:ai-chat:send', {
        detail: {
          text: `请把插件「${plugin.name}」（${plugin.pluginKey}）提交到插件市场：基于 main 新建分支、上传插件文件并更新市场清单、创建 Pull Request 请求仓库管理员 review 审核，不要自动合并。`,
        },
      }),
    );
  };

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
            共 {builtinPlugins.length} 个内置插件 · 已启用 {installedCount} 个 · 点击卡片查看详情与方法
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
              {sortedPlugins.map((plugin) => {
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
                            {installed?.installedAt && (
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
                                  disabled={busy || plugin.isCore}
                                  className="h-7 px-2 text-xs border-white/10 text-indigo-300 hover:text-indigo-200 hover:border-indigo-500/40"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSubmitToMarket(plugin);
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

      {/* 在线插件市场（GitHub 数据源） */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-400" />
            在线插件市场
          </CardTitle>
          <CardDescription className="text-zinc-400">
            数据源：GitHub · zhou415770319/life-os-plugins · 清单缓存 10 分钟，安装后插件数据保存在本地
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMarket ? (
            <div className="flex items-center justify-center py-10 text-zinc-500 text-sm">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              正在连接插件市场...
            </div>
          ) : marketItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-500">
              在线市场暂时无法访问，请检查网络或仓库配置（不影响内置插件）
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {marketItems.map((item) => {
                const Icon = getPluginIcon(item.cardIcon);
                const busy = marketBusyKey === item.pluginKey;
                const hasUpdate = item.installed && item.installedVersion !== item.version;
                return (
                  <div
                    key={item.pluginKey}
                    className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-200 ${
                      item.installed
                        ? 'border-emerald-500/30 bg-emerald-500/[0.04] hover:border-emerald-500/50'
                        : 'border-white/10 bg-white/[0.02] hover:border-sky-400/40'
                    }`}
                  >
                    <div
                      className="absolute top-0 left-0 w-full h-0.5"
                      style={{
                        background: `linear-gradient(to right, ${item.gradientFrom}, ${item.gradientTo})`,
                      }}
                    />
                    <div className="flex items-start gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${item.gradientFrom}, ${item.gradientTo})`,
                        }}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-zinc-50">{item.name}</span>
                          <span className="text-xs text-zinc-500">v{item.version}</span>
                          <Badge variant="outline" className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs px-1.5">
                            在线
                          </Badge>
                          {item.installed && (
                            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-1.5">
                              <Check className="w-3 h-3 mr-0.5" /> 已安装
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{item.description}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                          <span className="px-1.5 py-0.5 rounded bg-white/5">
                            {categoryLabels[item.category] ?? item.category}
                          </span>
                          {item.installed && (
                            <span className="px-1.5 py-0.5 rounded bg-white/5">
                              本地 v{item.installedVersion}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {item.installed ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              className="h-7 px-2 text-xs border-white/10 text-indigo-300 hover:text-indigo-200 hover:border-indigo-500/40"
                              onClick={() => handleSubmitToMarket(item)}
                            >
                              <Send className="w-3 h-3 mr-1" />
                              提交市场
                            </Button>
                            {hasUpdate && (
                              <Button
                                size="sm"
                                disabled={busy}
                                className="h-7 px-3 text-xs bg-gradient-to-r from-sky-500 to-cyan-600 border-0 text-white hover:opacity-90"
                                onClick={() => handleMarketAction(item, 'update')}
                              >
                                {busy ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                )}
                                更新到 v{item.version}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              className="h-7 px-2 text-xs border-white/10 text-rose-300 hover:text-rose-200 hover:border-rose-500/30"
                              onClick={() => handleMarketAction(item, 'uninstall')}
                            >
                              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3 mr-1" />}
                              卸载
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            disabled={busy}
                            className="h-7 px-3 text-xs bg-gradient-to-r from-indigo-500 to-purple-600 border-0 text-white hover:opacity-90"
                            onClick={() => handleMarketAction(item, 'install')}
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

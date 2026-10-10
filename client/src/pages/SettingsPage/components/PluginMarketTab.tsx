import { useCallback, useEffect, useState } from 'react';
import {
  Store,
  Globe,
  Package,
  Download,
  Check,
  Loader2,
  RefreshCw,
  Trash2,
  Info,
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
import { getPluginIcon } from '@client/src/utils/plugin-icons';
import { marketApi } from '@client/src/api';
import { toast } from 'sonner';
import PluginDetailDialog from './PluginDetailDialog';

const categoryLabels: Record<string, string> = {
  core: '核心模块',
  education: '教育学习',
  productivity: '效率工具',
  finance: '财务管理',
  lifestyle: '生活方式',
  health: '健康管理',
};

interface PluginMarketTabProps {
  plugins: AvailablePlugin[];
  installedPlugins: InstalledPlugin[];
  loading: boolean;
  installingKey: string | null;
  uninstallingKey: string | null;
  onInstall: (plugin: AvailablePlugin) => void;
  onUninstall: (plugin: AvailablePlugin | InstalledPlugin) => void;
  /** 数据变更后刷新（安装/卸载/更新后调用） */
  onDataChanged?: () => void;
}

/**
 * 插件市场（合并版）：在线插件市场（GitHub 数据源）+ 内置插件市场
 * - 在线插件市场：支持刷新按钮手动更新插件列表（点击「刷新」立即拉取最新市场清单）
 * - 内置插件市场：平台内置插件，未安装可安装，已安装显示状态（管理在「插件中心」）
 */
const PluginMarketTab: React.FC<PluginMarketTabProps> = ({
  plugins,
  installedPlugins,
  loading,
  installingKey,
  uninstallingKey,
  onInstall,
  onUninstall,
  onDataChanged,
}) => {
  const [marketItems, setMarketItems] = useState<MarketPluginItem[]>([]);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [marketBusyKey, setMarketBusyKey] = useState<string | null>(null);
  const [detailPlugin, setDetailPlugin] = useState<AvailablePlugin | null>(null);

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

  /** 手动刷新：重新拉取在线市场清单 + 本地插件数据 */
  const handleRefresh = async () => {
    await Promise.all([refreshMarket(), onDataChanged?.()]);
    toast.success('插件市场已刷新');
  };

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

  // 内置插件：过滤掉市场来源（市场来源在「在线插件市场」区块展示）
  const builtinPlugins = plugins.filter((p) => p.config?.source !== 'market');
  const isInstalled = (pluginKey: string) =>
    installedPlugins.some((p) => p.pluginKey === pluginKey && p.enabled);

  return (
    <div className="space-y-6">
      {/* ===== 在线插件市场（GitHub 数据源，支持手动刷新） ===== */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-400" />
                在线插件市场
              </CardTitle>
              <CardDescription className="text-zinc-400 mt-1">
                数据源：GitHub · zhou415770319/life-os-plugins · 安装后插件数据保存在本地
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={loadingMarket}
              onClick={handleRefresh}
              className="h-8 px-3 text-xs border-white/10 text-sky-300 hover:text-sky-200 hover:border-sky-500/40 shrink-0"
            >
              {loadingMarket ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
              )}
              刷新列表
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMarket ? (
            <div className="flex items-center justify-center py-10 text-zinc-500 text-sm">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              正在连接插件市场...
            </div>
          ) : marketItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-500">
              在线市场暂时无法访问，请检查网络或仓库配置，或点击「刷新列表」重试
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

      {/* ===== 内置插件市场 ===== */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-400" />
            内置插件市场
          </CardTitle>
          <CardDescription className="text-zinc-400">
            平台内置插件 · 共 {builtinPlugins.length} 个 · 未安装可直接安装，已安装请在「插件中心」管理
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
              {builtinPlugins.map((plugin) => {
                const Icon = getPluginIcon(plugin.config.cardIcon);
                const installed = getInstalled(plugin.pluginKey);
                const enabled = isInstalled(plugin.pluginKey);
                const busy = installingKey === plugin.pluginKey || uninstallingKey === plugin.pluginKey;

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
                            {enabled && (
                              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs px-1.5">
                                <Check className="w-3 h-3 mr-0.5" /> 已启用
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
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {enabled ? (
                            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                              <Check className="w-3 h-3 mr-1" /> 已安装
                            </Badge>
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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

export default PluginMarketTab;

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings, Puzzle, ScrollText, Database, KeyRound } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { pluginsApi } from '@client/src/api';
import type { AvailablePlugin, InstalledPlugin } from '@shared/api.interface';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@client/src/components/ui/tabs';
import { useConfirmDialog } from '@client/src/hooks/use-confirm-dialog';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import PluginCenterTab from './components/PluginCenterTab';
import AiSettingsTab from './components/AiSettingsTab';
import LifeLogPage from '../LifeLogPage/LifeLogPage';
import DataManagerPage from '../DataManagerPage/DataManagerPage';

const TAB_KEYS = ['plugins', 'life-log', 'data', 'ai'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const activeTab: TabKey = TAB_KEYS.includes(queryTab as TabKey)
    ? (queryTab as TabKey)
    : 'plugins';

  const [availablePlugins, setAvailablePlugins] = useState<AvailablePlugin[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [loadingInstalled, setLoadingInstalled] = useState(false);
  const [installingKey, setInstallingKey] = useState<string | null>(null);
  const [uninstallingKey, setUninstallingKey] = useState<string | null>(null);
  const [suspendingKey, setSuspendingKey] = useState<string | null>(null);
  const { openConfirm, ConfirmDialog } = useConfirmDialog();

  const refreshData = async () => {
    await Promise.all([fetchAvailable(), fetchInstalled()]);
  };

  const fetchAvailable = async () => {
    setLoadingAvailable(true);
    try {
      const data = await pluginsApi.getAvailablePlugins();
      setAvailablePlugins(data.items);
    } catch (err) {
      logger.error('Fetch available plugins failed', { error: String(err) });
      toast.error('加载可用插件失败');
    } finally {
      setLoadingAvailable(false);
    }
  };

  const fetchInstalled = async () => {
    setLoadingInstalled(true);
    try {
      const data = await pluginsApi.getInstalledPlugins();
      const items = [...data.items].sort((a, b) =>
        (b.installedAt || '').localeCompare(a.installedAt || ''),
      );
      setInstalledPlugins(items);
    } catch (err) {
      logger.error('Fetch installed plugins failed', { error: String(err) });
      toast.error('加载已安装插件失败');
    } finally {
      setLoadingInstalled(false);
    }
  };

  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTab = (tab: TabKey) => {
    if (tab === 'plugins') setSearchParams({});
    else setSearchParams({ tab });
  };

  const handleInstall = async (plugin: AvailablePlugin) => {
    setInstallingKey(plugin.pluginKey);
    try {
      await pluginsApi.installPlugin(plugin.pluginKey);
      toast.success(`已安装「${plugin.name}」`);
      await refreshData();
      window.dispatchEvent(new CustomEvent('life-os:plugin-updated'));
    } catch (err: any) {
      const msg = err?.response?.data?.message || '安装失败';
      logger.error('Install plugin failed', { error: String(err), pluginKey: plugin.pluginKey });
      toast.error(msg);
    } finally {
      setInstallingKey(null);
    }
  };

  const handleUninstall = async (plugin: AvailablePlugin | InstalledPlugin) => {
    const confirmed = await openConfirm({
      title: '确认卸载插件',
      description: `确定要卸载「${plugin.name}」吗？\n卸载后，该插件的导航入口和首页看板卡片将被移除，插件相关数据可能会被清除。`,
      confirmText: '确认卸载',
      cancelText: '取消',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setUninstallingKey(plugin.pluginKey);
    try {
      await pluginsApi.uninstallPlugin(plugin.pluginKey);
      toast.success(`已卸载「${plugin.name}」`);
      await refreshData();
      window.dispatchEvent(new CustomEvent('life-os:plugin-updated'));
    } catch (err: any) {
      const msg = err?.response?.data?.message || '卸载失败';
      logger.error('Uninstall plugin failed', { error: String(err), pluginKey: plugin.pluginKey });
      toast.error(msg);
    } finally {
      setUninstallingKey(null);
    }
  };

  const handleSuspend = async (plugin: InstalledPlugin) => {
    setSuspendingKey(plugin.pluginKey);
    try {
      await pluginsApi.suspendPlugin(plugin.pluginKey);
      toast.success(`已暂停「${plugin.name}」`);
      await refreshData();
      window.dispatchEvent(new CustomEvent('life-os:plugin-updated'));
    } catch (err: any) {
      const msg = err?.response?.data?.message || '暂停失败';
      logger.error('Suspend plugin failed', { error: String(err), pluginKey: plugin.pluginKey });
      toast.error(msg);
    } finally {
      setSuspendingKey(null);
    }
  };

  const handleResume = async (plugin: InstalledPlugin) => {
    setSuspendingKey(plugin.pluginKey);
    try {
      await pluginsApi.resumePlugin(plugin.pluginKey);
      toast.success(`已恢复「${plugin.name}」`);
      await refreshData();
      window.dispatchEvent(new CustomEvent('life-os:plugin-updated'));
    } catch (err: any) {
      const msg = err?.response?.data?.message || '恢复失败';
      logger.error('Resume plugin failed', { error: String(err), pluginKey: plugin.pluginKey });
      toast.error(msg);
    } finally {
      setSuspendingKey(null);
    }
  };

  const isInstalled = (pluginKey: string) =>
    installedPlugins.some((p) => p.pluginKey === pluginKey && p.enabled);

  const getInstalledPlugin = (pluginKey: string) =>
    installedPlugins.find((p) => p.pluginKey === pluginKey);

  const installedCount = installedPlugins.filter((p) => p.enabled).length;
  const availableCount = availablePlugins.length;

  return (
    <div className="min-h-full p-6 md:p-10">
      <BackgroundGlow variant="compact" />

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-400" />
          系统设置
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          插件中心、人生日志、数据管理与 AI 配置
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
        <TabsList className="mb-6 bg-white/[0.03] border border-white/10 p-1">
          <TabsTrigger value="plugins" className="data-[state=active]:bg-white/10">
            <Puzzle className="w-4 h-4 mr-2" />
            插件中心
          </TabsTrigger>
          <TabsTrigger value="life-log" className="data-[state=active]:bg-white/10">
            <ScrollText className="w-4 h-4 mr-2" />
            人生日志
          </TabsTrigger>
          <TabsTrigger value="data" className="data-[state=active]:bg-white/10">
            <Database className="w-4 h-4 mr-2" />
            数据管理
          </TabsTrigger>
          <TabsTrigger value="ai" className="data-[state=active]:bg-white/10">
            <KeyRound className="w-4 h-4 mr-2" />
            AI 配置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plugins">
          <PluginCenterTab
            plugins={availablePlugins}
            installedPlugins={installedPlugins}
            loading={loadingAvailable || loadingInstalled}
            installingKey={installingKey}
            uninstallingKey={uninstallingKey}
            suspendingKey={suspendingKey}
            onInstall={handleInstall}
            onUninstall={handleUninstall}
            onSuspend={handleSuspend}
            onResume={handleResume}
            onDataChanged={refreshData}
          />
        </TabsContent>

        <TabsContent value="life-log">
          {/* 子页面自带内边距，用负 margin 抵消外层 padding */}
          <div className="-m-6 md:-m-10">
            <LifeLogPage />
          </div>
        </TabsContent>

        <TabsContent value="data">
          <div className="-m-6 md:-m-10">
            <DataManagerPage />
          </div>
        </TabsContent>

        <TabsContent value="ai">
          <AiSettingsTab />
        </TabsContent>
      </Tabs>

      {ConfirmDialog}
    </div>
  );
};

export default SettingsPage;

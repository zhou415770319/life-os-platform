import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings, Puzzle, Store, ScrollText, Database, KeyRound, UserCircle2, LogOut } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { pluginsApi, authApi } from '@client/src/api';
import type { AvailablePlugin, InstalledPlugin } from '@shared/api.interface';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@client/src/components/ui/tabs';
import { useConfirmDialog } from '@client/src/hooks/use-confirm-dialog';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import PluginCenterTab from './components/PluginCenterTab';
import PluginMarketTab from './components/PluginMarketTab';
import AiSettingsTab from './components/AiSettingsTab';
import LifeLogPage from '../LifeLogPage/LifeLogPage';
import DataManagerPage from '../DataManagerPage/DataManagerPage';

const TAB_KEYS = ['plugins', 'market', 'life-log', 'data', 'ai', 'account'] as const;
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
          <TabsTrigger value="market" className="data-[state=active]:bg-white/10">
            <Store className="w-4 h-4 mr-2" />
            插件市场
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
          <TabsTrigger value="account" className="data-[state=active]:bg-white/10">
            <UserCircle2 className="w-4 h-4 mr-2" />
            账号
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

        <TabsContent value="market">
          <PluginMarketTab
            plugins={availablePlugins}
            installedPlugins={installedPlugins}
            loading={loadingAvailable || loadingInstalled}
            installingKey={installingKey}
            uninstallingKey={uninstallingKey}
            onInstall={handleInstall}
            onUninstall={handleUninstall}
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

        <TabsContent value="account">
          <AccountTab />
        </TabsContent>
      </Tabs>

      {ConfirmDialog}
    </div>
  );
};

/** 账号信息 Tab：当前登录用户 + 退出登录 + 邀请码管理（仅管理员） */
function AccountTab() {
  const user = authApi.getLifeOsUser();
  const isAdmin = user?.role === 'admin';
  const handleLogout = () => {
    authApi.lifeOsLogoutLocal();
  };
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600">
            <UserCircle2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="text-lg font-semibold text-white">{user?.username ?? '-'}</div>
            <div className="text-sm text-zinc-400">
              {isAdmin ? '管理员' : '普通用户'}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-2.5 text-sm text-zinc-300 transition hover:border-red-500/40 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
        <p className="mt-4 text-center text-xs text-zinc-500">
          用户数据保存在本地（user-data/users.json），后期可切换飞书多维表格或数据库
        </p>
      </div>

      {isAdmin && <InviteCodeManager />}
    </div>
  );
}

/** 邀请码管理：生成 / 列表 / 复制 / 作废（仅管理员可见） */
function InviteCodeManager() {
  const [codes, setCodes] = useState<AuthInviteCode[]>([]);
  const [count, setCount] = useState(1);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState('');

  const refresh = async () => {
    try {
      const list = await authApi.inviteList();
      setCodes(list);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '邀请码列表加载失败');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const created = await authApi.inviteCreate(count, days);
      toast.success(`已生成 ${created.length} 个邀请码`);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  const handleRevoke = async (code: string) => {
    const ok = window.confirm(`确定作废邀请码 ${code} 吗？作废后不可恢复`);
    if (!ok) return;
    try {
      const res = await authApi.inviteRevoke(code);
      if (res?.success) {
        toast.success('已作废');
        refresh();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '作废失败');
    }
  };

  const statusOf = (c: AuthInviteCode): { label: string; cls: string } => {
    if (c.revoked) return { label: '已作废', cls: 'bg-red-500/15 text-red-400 border-red-500/30' };
    if (c.usedBy) return { label: '已使用', cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' };
    if (Date.now() > new Date(c.expiresAt).getTime()) {
      return { label: '已过期', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    }
    return { label: '有效', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString('zh-CN', { hour12: false });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-indigo-400" />
        <h3 className="text-base font-semibold text-white">邀请码管理</h3>
        <span className="text-xs text-zinc-500">新用户注册需凭邀请码</span>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">生成数量</label>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-24 rounded-lg border border-white/10 bg-[#1c2128] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">有效期（天）</label>
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-24 rounded-lg border border-white/10 bg-[#1c2128] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? '生成中...' : '生成邀请码'}
        </button>
      </div>

      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
        {codes.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">
            暂无邀请码，生成后新用户即可凭码注册
          </p>
        ) : (
          codes.map((c) => {
            const st = statusOf(c);
            return (
              <div
                key={c.code}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[#1c2128] px-3 py-2"
              >
                <span className="font-mono text-sm tracking-wider text-white">{c.code}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${st.cls}`}
                >
                  {st.label}
                </span>
                <span className="text-xs text-zinc-500">
                  创建 {fmt(c.createdAt)}
                </span>
                <span className="text-xs text-zinc-500">
                  到期 {fmt(c.expiresAt)}
                </span>
                {c.usedBy && (
                  <span className="text-xs text-zinc-400">使用于 {fmt(c.usedAt ?? '')}</span>
                )}
                <span className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(c.code)}
                    className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300 transition hover:border-indigo-500/40 hover:text-indigo-300"
                  >
                    {copied === c.code ? '已复制' : '复制'}
                  </button>
                  {!c.revoked && !c.usedBy && (
                    <button
                      onClick={() => handleRevoke(c.code)}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300 transition hover:border-red-500/40 hover:text-red-400"
                    >
                      作废
                    </button>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

type AuthInviteCode = {
  code: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  usedBy?: string;
  usedAt?: string;
  revoked?: boolean;
};

export default SettingsPage;

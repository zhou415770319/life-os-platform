import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Target,
  Clock,
  Brain,
  Settings,
  Menu,
  X,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  RefreshCcw,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePlugins } from '@client/src/hooks/use-plugins';
import { getPluginIcon } from '@client/src/utils/plugin-icons';
import BackgroundGlow from '@client/src/components/ui/background-glow';

const coreNavItems = [
  { path: '/', label: '人生看板', icon: LayoutDashboard, key: 'dashboard' },
  { path: '/insights', label: '数据洞察', icon: TrendingUp, key: 'insights' },
  { path: '/review', label: '自动复盘', icon: RefreshCcw, key: 'review' },
  { path: '/goals', label: '愿景目标', icon: Target, key: 'goals' },
  { path: '/habits', label: '微习惯', icon: Clock, key: 'habits' },
  { path: '/notes', label: '认知笔记', icon: Brain, key: 'notes' },
];

// 系统设置分组：仅保留「系统设置」一个入口，插件中心/人生日志/数据管理均以页签形式收在设置页内
const settingsNavItems = [
  { path: '/settings', label: '系统设置', icon: Settings, key: 'settings' },
];

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { enabledPlugins, error: pluginError } = usePlugins();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const pluginNavItems = enabledPlugins.map((p) => ({
    path: p.config.routePath,
    label: p.config.cardTitle,
    icon: getPluginIcon(p.config.cardIcon),
    key: p.pluginKey,
  }));

  const NavSection = ({
    title,
    items,
  }: {
    title: string;
    items: { path: string; label: string; icon: React.ComponentType<{ className?: string }>; key: string; tab?: string }[];
  }) => (
    <>
      <div className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {title}
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.path === '/' && !item.tab
            ? location.pathname === '/'
            : item.tab !== undefined
              ? location.pathname === '/settings' &&
                (item.tab === ''
                  ? !location.search.includes('tab=')
                  : location.search.includes(`tab=${item.tab}`))
              : location.pathname.startsWith(item.path);
        const to = item.tab ? `${item.path}?tab=${item.tab}` : item.path;
        return (
          <NavLink
            key={item.key}
            to={to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
              isActive
                ? 'bg-white/10 text-white border border-white/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-2 md:hidden">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Life-OS</div>
            <div className="text-xs text-zinc-500">Core Kernel v1.0.0</div>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="关闭菜单"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="hidden md:flex items-center gap-3 px-3 py-4 mb-2">
        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-breathe" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">Life-OS</div>
          <div className="text-xs text-zinc-500">Core Kernel v1.0.0</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        <NavSection title="核心模块" items={coreNavItems} />

        {pluginNavItems.length > 0 && (
          <div className="mt-4">
            <NavSection title="已装载插件" items={pluginNavItems} />
          </div>
        )}

        {pluginError && (
          <div className="mt-4 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/10">
            <div className="flex items-center gap-2 text-amber-400 text-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{pluginError}</span>
            </div>
          </div>
        )}

        <div className="mt-4">
          <NavSection title="系统设置" items={settingsNavItems} />
        </div>
      </nav>

      <div className="mt-auto pt-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center text-xs font-medium">
            OS
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">System Runtime</div>
            <div className="text-xs text-zinc-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-breathe" />
              Online
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[hsl(240_6%_4%)] text-[hsl(0_0%_98%)] flex overflow-hidden">
      <BackgroundGlow variant="layout" />

      {/* 桌面端侧边栏 */}
      <aside className="hidden md:flex relative z-10 w-64 flex-shrink-0 border-r border-white/5 bg-black/20 backdrop-blur-xl">
        <SidebarContent />
      </aside>

      {/* 移动端抽屉背景遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 移动端抽屉侧边栏 */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-white/5 bg-black/60 backdrop-blur-xl transition-transform duration-300 md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      <main className="relative z-10 flex-1 overflow-y-auto">
        {/* 移动端顶部栏 */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-black/40 px-4 py-3 backdrop-blur-xl md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="打开菜单"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <div className="text-sm font-semibold">Life-OS</div>
          </div>
          <div className="w-9" />
        </div>
        <div className="min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;

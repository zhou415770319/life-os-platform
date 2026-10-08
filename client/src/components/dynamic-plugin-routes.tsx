import { usePlugins } from '@client/src/hooks/use-plugins';
import { Navigate, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import ChildResourcesPage from '@client/src/pages/ChildResourcesPage/ChildResourcesPage';
import RpaCenterPage from '@client/src/pages/RpaCenterPage/RpaCenterPage';
import TasksPage from '@client/src/pages/TasksPage/TasksPage';
import FinancePage from '@client/src/pages/FinancePage/FinancePage';
import HealthPage from '@client/src/pages/HealthPage/HealthPage';
import ReviewBoardPage from '@client/src/pages/ReviewBoardPage/ReviewBoardPage';
import ChildTvAdminPage from '@client/src/pages/ChildTvAdminPage/ChildTvAdminPage';
import { Loader2 } from 'lucide-react';

const pluginPageMap: Record<string, React.ComponentType> = {
  'dsh-plugin-child-resources': ChildResourcesPage,
  'dsh-plugin-wechat-rpa': RpaCenterPage,
  'dsh-plugin-tasks-gtd': TasksPage,
  'dsh-plugin-finance-ledger': FinancePage,
  'dsh-plugin-health-fit': HealthPage,
  'dsh-plugin-review-board': ReviewBoardPage,
  'dsh-plugin-child-tv': ChildTvAdminPage,
};

export default function DynamicPluginRoutes() {
  const { enabledPlugins, loading } = usePlugins();
  const location = useLocation();

  const matchedPlugin = useMemo(() => {
    const path = location.pathname;
    return enabledPlugins.find(
      (p) => p.config.routePath === path || p.config.routePath === `${path}/`,
    );
  }, [location.pathname, enabledPlugins]);

  const shouldRedirect =
    !loading && (!matchedPlugin || !pluginPageMap[matchedPlugin.pluginKey]);

  if (shouldRedirect) {
    if (!matchedPlugin) {
      logger.warn(`No plugin matched for path: ${location.pathname}`);
    } else {
      logger.warn(`No page component for plugin: ${matchedPlugin.pluginKey}`);
    }
    return <Navigate to="/" replace />;
  }

  const PageComp = matchedPlugin
    ? pluginPageMap[matchedPlugin.pluginKey]
    : null;

  return (
    <div data-plugin-page-root>
      {loading ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-6 backdrop-blur-xl">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            <span className="text-sm text-zinc-400">加载中...</span>
          </div>
        </div>
      ) : PageComp ? (
        <PageComp />
      ) : null}
    </div>
  );
}

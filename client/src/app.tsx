import React, { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import Layout from './components/Layout';
import AuthGate from './components/AuthGate';
import DashboardPage from './pages/Dashboard/DashboardPage';
import AiChat from './components/AiChat/AiChat';
import DynamicPluginRoutes from './components/dynamic-plugin-routes';
import { PluginsProvider } from './hooks/use-plugins';
import { AppQueryProvider } from './components/providers/query-provider';

const LoginPage = lazy(() => import('./pages/LoginPage/LoginPage'));

const GoalsPage = lazy(() => import('./pages/GoalsPage/GoalsPage'));
const HabitsPage = lazy(() => import('./pages/HabitsPage/HabitsPage'));
const NotesPage = lazy(() => import('./pages/NotesPage/NotesPage'));
const DataManagerPage = lazy(
  () => import('./pages/DataManagerPage/DataManagerPage'),
);
const SettingsPage = lazy(
  () => import('./pages/SettingsPage/SettingsPage'),
);
const PluginCenterPage = lazy(
  () => import('./pages/PluginCenterPage/PluginCenterPage'),
);
const LifeLogPage = lazy(() => import('./pages/LifeLogPage/LifeLogPage'));
const PomodoroPage = lazy(
  () => import('./pages/PomodoroPage/PomodoroPage'),
);
const TimeBlackholePage = lazy(
  () => import('./pages/TimeBlackholePage/TimeBlackholePage'),
);
const RpaManagerPage = lazy(
  () => import('./pages/RpaManagerPage/RpaManagerPage'),
);
const InsightsPage = lazy(() => import('./pages/InsightsPage/InsightsPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage/ReviewPage'));
const ChildTvWatchPage = lazy(
  () => import('./pages/ChildTvWatchPage/ChildTvWatchPage'),
);
const ChildTvAdminPage = lazy(
  () => import('./pages/ChildTvAdminPage/ChildTvAdminPage'),
);
const NotFound = lazy(() => import('./pages/NotFound/NotFound'));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-6 backdrop-blur-xl">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
        <span className="text-sm text-zinc-400">加载中...</span>
      </div>
    </div>
  );
}

const RoutesComponent = () => {
  return (
    <AppQueryProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* 登录/注册页（独立布局，无需登录） */}
          <Route path="/login" element={<LoginPage />} />
          {/* 儿童观看页：独立布局（无侧边栏、无任何操作入口，只读免登录） */}
          <Route path="child-tv" element={<ChildTvWatchPage />} />
          {/* 儿童定时播放家长控制台：免登录（本机共享配置，链接直达即用） */}
          <Route path="child-tv-admin" element={<ChildTvAdminPage />} />
          {/* 主应用：全站强制登录（插件上下文 + AI 助手仅登录后加载，避免登录页 401 请求） */}
          <Route
            element={
              <AuthGate>
                <PluginsProvider>
                  <>
                    <Layout />
                    <AiChat />
                  </>
                </PluginsProvider>
              </AuthGate>
            }
          >
              <Route index element={<DashboardPage />} />
              <Route path="goals" element={<GoalsPage />} />
              <Route path="habits" element={<HabitsPage />} />
              <Route path="notes" element={<NotesPage />} />
              <Route
                path="data-manager"
                element={<DataManagerPage />}
              />
              <Route path="settings" element={<SettingsPage />} />
              <Route
                path="plugin-center"
                element={<PluginCenterPage />}
              />
              <Route path="life-log" element={<LifeLogPage />} />
              <Route path="pomodoro" element={<PomodoroPage />} />
              <Route path="time-blackhole" element={<TimeBlackholePage />} />
              <Route path="rpa-manager" element={<RpaManagerPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="review" element={<ReviewPage />} />
              <Route path="*" element={<DynamicPluginRoutes />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
    </AppQueryProvider>
  );
};

export default RoutesComponent;

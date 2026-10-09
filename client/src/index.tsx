import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

import { AppContainer } from '@lark-apaas/client-toolkit/components/AppContainer';

import RoutesComponent from './app.tsx';
import './index.css';
import { createPortal } from 'react-dom';
import { Toaster } from '@client/src/components/ui/sonner';

const CLIENT_BASE_PATH = process.env.CLIENT_BASE_PATH || '/';

/** 瞬态 DOM 竞争错误（React removeChild/insertBefore/重复挂载），不当作致命错误展示 */
function isTransientDomError(error: Error): boolean {
  const msg = String(error?.message ?? '');
  return (
    msg.includes('removeChild') ||
    msg.includes('insertBefore') ||
    msg.includes('NotFoundError') ||
    msg.includes('createRoot') ||
    msg.includes('postMessage')
  );
}

/** 自定义错误兜底：瞬态错误自动恢复页面，真实业务错误展示可重试的错误页 */
function AppErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  const transient = isTransientDomError(error);

  useEffect(() => {
    if (transient) {
      const timer = setTimeout(() => resetErrorBoundary(), 300);
      return () => clearTimeout(timer);
    }
  }, [transient, resetErrorBoundary]);

  if (transient) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(240_6%_4%)]">
      <div className="flex flex-col items-center text-center gap-3 px-6">
        <div className="text-2xl">⚠️</div>
        <p className="text-sm font-medium text-zinc-100">页面出错了</p>
        <p className="text-xs text-zinc-500 max-w-sm break-all">
          {String(error?.message ?? error)}
        </p>
        <button
          onClick={resetErrorBoundary}
          className="mt-1 px-4 py-1.5 rounded-lg bg-white/10 text-zinc-100 text-xs hover:bg-white/20 transition-colors"
        >
          重新加载页面
        </button>
      </div>
    </div>
  );
}

const MainApp = () => {
  return (
    <BrowserRouter basename={CLIENT_BASE_PATH}>
      <AppContainer defaultTheme="light">
        <ErrorBoundary
          fallbackRender={AppErrorFallback}
          onError={(error, info) => {
            console.error('[BOUNDARY-CAUGHT]', error, info?.componentStack);
          }}
        >
          <RoutesComponent />
        </ErrorBoundary>
        {/* Toaster portal 置于 ErrorBoundary 之外，避免边界卸载时触发 removeChild 竞争 */}
        {createPortal(<Toaster />, document.body)}
      </AppContainer>
    </BrowserRouter>
  );
};

createRoot(document.getElementById('root')!).render(<MainApp />);

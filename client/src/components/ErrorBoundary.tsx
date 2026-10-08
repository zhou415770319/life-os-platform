import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error('ErrorBoundary caught error', {
      error: String(error),
      componentStack: errorInfo.componentStack,
    });
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10">
              <AlertTriangle className="h-6 w-6 text-rose-400" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-zinc-50">
              页面加载出错
            </h2>
            <p className="mb-6 text-sm text-zinc-400">
              该模块出现了意料之外的错误，你可以尝试刷新或返回上一页继续使用其他功能。
            </p>
            {this.state.error?.message && (
              <div className="mb-6 rounded-lg border border-white/5 bg-black/30 p-3 text-left text-xs text-zinc-500 break-words">
                {this.state.error.message}
              </div>
            )}
            <div className="flex justify-center gap-3">
              <Button
                onClick={this.handleReload}
                className="bg-gradient-to-br from-indigo-500 to-purple-600 border-0 hover:opacity-90"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                重试
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

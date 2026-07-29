import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Home, RotateCcw } from 'lucide-react';
import { isStaleChunkError, recoverFromStaleChunk } from '../../utils/chunkRecovery';
import { reportClientError } from '../../services/observability/clientErrorReporter';
import { toAppError } from '../../services/api/errors';
import { Button } from './Button';
import { SupportError } from './SupportError';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    const staleChunk = isStaleChunkError(error);
    reportClientError(error, {
      event: staleChunk ? 'stale_chunk_error' : 'react_error_boundary',
      componentStack: errorInfo.componentStack || undefined,
    });
    if (recoverFromStaleChunk(error)) return;
    if (process.env.NODE_ENV === 'development') console.error('[ErrorBoundary]', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const error = toAppError(this.state.error);
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
        <section className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg" aria-label="Thông báo lỗi ứng dụng">
          <SupportError error={error} title="Ứng dụng gặp sự cố" onRetry={this.handleReset} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" icon={<Home />} onClick={() => { window.location.href = '/'; }}>Về trang chủ</Button>
            <Button variant="ghost" icon={<RotateCcw />} onClick={() => window.location.reload()}>Tải lại trang</Button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details className="text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold">Chi tiết dành cho phát triển</summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-100 p-3">{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { recoverFromStaleChunk } from '../../utils/chunkRecovery';

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

/**
 * Error Boundary component to catch JavaScript errors in child components
 * and display a fallback UI instead of crashing the whole app.
 */
class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo });

        // A tab opened before a deployment can still reference removed hashed chunks.
        // Reload once to fetch the current HTML/module graph instead of showing a fatal error.
        if (recoverFromStaleChunk(error)) return;

        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Error info:', errorInfo);
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        this.props.onReset?.();
    };

    handleReload = (): void => {
        window.location.reload();
    };

    handleGoHome = (): void => {
        window.location.href = '/';
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-100 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white text-center">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-bold">Đã xảy ra lỗi</h2>
                            <p className="text-red-100 mt-2 text-sm">
                                Rất tiếc, ứng dụng gặp sự cố không mong muốn
                            </p>
                        </div>

                        {/* Error Details (only in development) */}
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="p-4 bg-gray-50 border-b border-gray-200">
                                <p className="text-xs font-mono text-red-600 break-all">
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <details className="mt-2">
                                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                            Chi tiết lỗi
                                        </summary>
                                        <pre className="mt-2 text-xs text-gray-600 overflow-auto max-h-32 bg-gray-100 p-2 rounded">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="p-6 space-y-3">
                            <button
                                onClick={this.handleReset}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Thử lại
                            </button>

                            <button
                                onClick={this.handleGoHome}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                            >
                                <Home className="w-5 h-5" />
                                Về trang chủ
                            </button>

                            <button
                                onClick={this.handleReload}
                                className="w-full text-center py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Tải lại trang
                            </button>
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-4 text-center">
                            <p className="text-xs text-gray-400">
                                Nếu lỗi vẫn tiếp tục, vui lòng liên hệ quản trị viên
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

import { formatSystemDateTime } from '../../utils/dateTime';
import React from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { EmptyState, type EmptyStateProps } from './EmptyState';
import { Skeleton } from './Skeleton';

export interface DataFreshnessNoticeProps {
    staleAt?: Date | number | string | null;
    isOffline?: boolean;
    isRefreshing?: boolean;
    className?: string;
}

const parseTimestamp = (value: DataFreshnessNoticeProps['staleAt']): Date | null => {
    if (value === null || value === undefined) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const DataFreshnessNotice: React.FC<DataFreshnessNoticeProps> = ({
    staleAt,
    isOffline = false,
    isRefreshing = false,
    className = '',
}) => {
    const timestamp = parseTimestamp(staleAt);
    if (!timestamp && !isOffline && !isRefreshing) return null;

    const timestampLabel = timestamp
        ? formatSystemDateTime(timestamp)
        : null;
    const prefix = isOffline
        ? 'Bạn đang xem dữ liệu đã tải trước đó.'
        : isRefreshing
            ? 'Đang cập nhật dữ liệu.'
            : 'Dữ liệu đã sẵn sàng.';

    return (
        <p
            role="status"
            aria-live="polite"
            className={`rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 ${className}`}
        >
            {prefix}{timestampLabel ? ` Dữ liệu gần nhất: ${timestampLabel}.` : ''}
        </p>
    );
};

export interface AsyncStateProps {
    loading?: boolean;
    error?: string | null;
    empty?: boolean;
    hasData?: boolean;
    onRetry?: () => void;
    retryDisabled?: boolean;
    loadingLabel?: string;
    loadingFallback?: React.ReactNode;
    emptyState?: EmptyStateProps;
    staleAt?: DataFreshnessNoticeProps['staleAt'];
    isOffline?: boolean;
    children: React.ReactNode;
}

export const AsyncState: React.FC<AsyncStateProps> = ({
    loading = false,
    error,
    empty = false,
    hasData = false,
    onRetry,
    retryDisabled = false,
    loadingLabel = 'Đang tải dữ liệu',
    loadingFallback,
    emptyState,
    staleAt,
    isOffline = false,
    children,
}) => {
    if (loading && !hasData) {
        return <>{loadingFallback ?? <Skeleton label={loadingLabel} className="h-28 w-full" />}</>;
    }

    if (error && !hasData) {
        return (
            <Alert tone="danger" title="Không thể tải dữ liệu">
                <p>{error}</p>
                {onRetry && (
                    <Button
                        className="mt-3"
                        size="sm"
                        variant="secondary"
                        onClick={onRetry}
                        disabled={retryDisabled}
                        title={retryDisabled ? 'Cần kết nối mạng để thử lại.' : undefined}
                    >
                        Thử lại
                    </Button>
                )}
            </Alert>
        );
    }

    if (empty && !hasData && emptyState) return <EmptyState {...emptyState} />;

    return (
        <div className="space-y-3">
            {error && hasData ? (
                <Alert tone="warning" title="Dữ liệu chưa được cập nhật">
                    <p>{error}</p>
                    {onRetry && (
                        <Button
                            className="mt-3"
                            size="sm"
                            variant="secondary"
                            onClick={onRetry}
                            disabled={retryDisabled}
                            title={retryDisabled ? 'Cần kết nối mạng để thử lại.' : undefined}
                        >
                            Thử lại
                        </Button>
                    )}
                </Alert>
            ) : null}
            <DataFreshnessNotice staleAt={staleAt} isOffline={isOffline} isRefreshing={loading && hasData} />
            {children}
        </div>
    );
};

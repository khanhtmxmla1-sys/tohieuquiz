import React from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { EmptyState, type EmptyStateProps } from './EmptyState';
import { Skeleton } from './Skeleton';

export interface AsyncStateProps {
    loading?: boolean;
    error?: string | null;
    empty?: boolean;
    onRetry?: () => void;
    loadingLabel?: string;
    emptyState?: EmptyStateProps;
    children: React.ReactNode;
}

export const AsyncState: React.FC<AsyncStateProps> = ({ loading, error, empty, onRetry, loadingLabel = 'Đang tải dữ liệu', emptyState, children }) => {
    if (loading) return <Skeleton label={loadingLabel} className="h-28 w-full" />;
    if (error) return (
        <Alert tone="danger" title="Không thể tải dữ liệu">
            <p>{error}</p>
            {onRetry && <Button className="mt-3" size="sm" variant="secondary" onClick={onRetry}>Thử lại</Button>}
        </Alert>
    );
    if (empty && emptyState) return <EmptyState {...emptyState} />;
    return <>{children}</>;
};

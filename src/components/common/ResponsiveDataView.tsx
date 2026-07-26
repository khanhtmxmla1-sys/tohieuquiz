import React from 'react';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

interface ResponsiveDataViewProps<T> {
    items: T[];
    keyExtractor: (item: T, index: number) => string;
    renderDesktop: () => React.ReactNode;
    renderMobileCard: (item: T, index: number) => React.ReactNode;
    emptyState?: React.ReactNode;
    mobileContainerClassName?: string;
}

export function ResponsiveDataView<T>({
    items,
    keyExtractor,
    renderDesktop,
    renderMobileCard,
    emptyState = null,
    mobileContainerClassName = 'space-y-3',
}: ResponsiveDataViewProps<T>) {
    const { isMobile } = useResponsiveLayout();

    if (items.length === 0) {
        return <>{emptyState}</>;
    }

    if (!isMobile) {
        return <>{renderDesktop()}</>;
    }

    return (
        <div className={mobileContainerClassName}>
            {items.map((item, index) => (
                <div
                    key={keyExtractor(item, index)}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                    {renderMobileCard(item, index)}
                </div>
            ))}
        </div>
    );
}

export default ResponsiveDataView;

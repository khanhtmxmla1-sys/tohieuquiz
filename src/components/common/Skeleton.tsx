import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> { label?: string }

export const Skeleton: React.FC<SkeletonProps> = ({ label = 'Đang tải', className = '', ...props }) => (
    <div role="status" aria-label={label} className={`animate-pulse rounded-lg bg-slate-200 ${className}`} {...props}>
        <span className="sr-only">{label}</span>
    </div>
);

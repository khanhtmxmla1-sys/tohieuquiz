/**
 * Common Card Component
 * 
 * Reusable card container with optional header.
 */

import React from 'react';

export interface CardProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    className?: string;
    headerAction?: React.ReactNode;
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles: Record<string, string> = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
};

export const Card: React.FC<CardProps> = ({
    children,
    title,
    subtitle,
    className = '',
    headerAction,
    padding = 'md',
}) => {
    return (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
            {(title || headerAction) && (
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        {title && <h3 className="text-lg font-semibold text-gray-800">{title}</h3>}
                        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
                    </div>
                    {headerAction && <div>{headerAction}</div>}
                </div>
            )}
            <div className={paddingStyles[padding]}>
                {children}
            </div>
        </div>
    );
};

export default Card;

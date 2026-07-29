import React, { useId } from 'react';

type CardElement = 'div' | 'section' | 'article';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
    children: React.ReactNode;
    as?: CardElement;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    headerAction?: React.ReactNode;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    headingLevel?: 2 | 3 | 4;
}

const paddingStyles = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' } as const;

export const Card: React.FC<CardProps> = ({
    children, as = 'div', title, subtitle, className = '', headerAction, padding = 'md', headingLevel = 3, ...props
}) => {
    const headingId = useId();
    const Heading = `h${headingLevel}` as React.ElementType;
    const Component = as;
    return (
        <Component className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`} aria-labelledby={title ? headingId : undefined} {...props}>
            {(title || subtitle || headerAction) && (
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
                    <div className="min-w-0">
                        {title && <Heading id={headingId} className="text-lg font-semibold text-slate-900">{title}</Heading>}
                        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
                    </div>
                    {headerAction && <div className="shrink-0">{headerAction}</div>}
                </div>
            )}
            <div className={paddingStyles[padding]}>{children}</div>
        </Component>
    );
};

export default Card;

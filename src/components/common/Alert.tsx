import React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
    tone?: 'info' | 'success' | 'warning' | 'danger';
    title?: React.ReactNode;
}

const config = {
    info: { icon: Info, classes: 'border-blue-200 bg-blue-50 text-blue-950' },
    success: { icon: CheckCircle2, classes: 'border-green-200 bg-green-50 text-green-950' },
    warning: { icon: TriangleAlert, classes: 'border-amber-300 bg-amber-50 text-amber-950' },
    danger: { icon: AlertCircle, classes: 'border-red-300 bg-red-50 text-red-950' },
} as const;

export const Alert: React.FC<AlertProps> = ({ tone = 'info', title, children, className = '', ...props }) => {
    const Icon = config[tone].icon;
    return (
        <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex gap-3 rounded-xl border p-4 ${config[tone].classes} ${className}`} {...props}>
            <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{title && <p className="font-semibold">{title}</p>}<div className="text-sm">{children}</div></div>
        </div>
    );
};

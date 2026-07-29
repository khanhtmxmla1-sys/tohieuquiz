import React from 'react';

export interface EmptyStateProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ReactNode;
    action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon, action }) => (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
        {icon && <div aria-hidden="true" className="mx-auto mb-3 w-fit text-slate-500">{icon}</div>}
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {description && <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
    </section>
);

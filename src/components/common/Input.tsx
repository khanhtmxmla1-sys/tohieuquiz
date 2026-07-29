import React, { forwardRef, useId } from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label: React.ReactNode;
    description?: React.ReactNode;
    error?: React.ReactNode;
    containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
    label, description, error, id, className = '', containerClassName = '', ...props
}, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const descriptionId = description ? `${inputId}-description` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;
    return (
        <div className={containerClassName}>
            <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-slate-800">{label}</label>
            {description && <p id={descriptionId} className="mb-2 text-sm text-slate-600">{description}</p>}
            <input ref={ref} id={inputId} aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy}
                className={`min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200 ${error ? 'border-red-600' : 'border-slate-300'} ${className}`}
                {...props} />
            {error && <p id={errorId} className="mt-1.5 text-sm font-medium text-red-700">{error}</p>}
        </div>
    );
});
Input.displayName = 'Input';

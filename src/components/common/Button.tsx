import React, { forwardRef } from 'react';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300',
    success: 'bg-green-700 hover:bg-green-800 text-white',
    danger: 'bg-red-700 hover:bg-red-800 text-white',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-800',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'min-h-11 px-3 py-2 text-sm',
    md: 'min-h-11 px-4 py-2 text-base',
    lg: 'min-h-12 px-6 py-3 text-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
    children, variant = 'primary', size = 'md', disabled = false, loading = false,
    className = '', type = 'button', icon, ...buttonProps
}, ref) => {
    const unavailable = disabled || loading;
    return (
        <button
            ref={ref}
            type={type}
            disabled={unavailable}
            aria-busy={loading || undefined}
            className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
            {...buttonProps}
        >
            {loading ? (
                <svg aria-hidden="true" className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            ) : icon ? <span aria-hidden="true">{icon}</span> : null}
            <span>{children}</span>
        </button>
    );
});

Button.displayName = 'Button';
export default Button;

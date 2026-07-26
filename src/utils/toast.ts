/**
 * Toast Utility - Centralized notification system
 * Uses react-hot-toast with Apple-style design
 * Position: top-center for optimal mobile visibility
 */
import toast from 'react-hot-toast';
import React from 'react';

// ─── Sound ───────────────────────────────────────────────────────────────────

/**
 * Play a soft "Ting" sound using Web Audio API — no MP3 file needed.
 * Used specifically when a student submits their quiz successfully.
 */
export const playTingSound = (): void => {
    try {
        const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note — bright & clear
        gain.gain.setValueAtTime(0.28, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.7);

        // Clean up context after sound finishes
        osc.onended = () => ctx.close();
    } catch {
        // Silently ignore — audio permission denied or unsupported
    }
};

// ─── Base Options ─────────────────────────────────────────────────────────────

const BASE_DURATION = 3500;

const baseStyle: React.CSSProperties = {
    fontFamily: "'Baloo 2', sans-serif",
    fontWeight: 600,
    fontSize: '0.93rem',
    borderRadius: '14px',
    padding: '12px 16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
};

// ─── Notification helpers ─────────────────────────────────────────────────────

/** Show a success toast */
export const showSuccess = (message: string, duration = BASE_DURATION): string =>
    toast.success(message, {
        duration,
        style: {
            ...baseStyle,
            background: '#f0fdf4',
            color: '#15803d',
        },
        iconTheme: { primary: '#22c55e', secondary: '#f0fdf4' },
    });

/** Show an error toast */
export const showError = (message: string, duration = BASE_DURATION): string =>
    toast.error(message, {
        duration,
        style: {
            ...baseStyle,
            background: '#fef2f2',
            color: '#dc2626',
        },
        iconTheme: { primary: '#ef4444', secondary: '#fef2f2' },
    });

/** Show an info / neutral toast */
export const showInfo = (message: string, duration = BASE_DURATION): string =>
    toast(message, {
        duration,
        icon: 'ℹ️',
        style: {
            ...baseStyle,
            background: '#eff6ff',
            color: '#1d4ed8',
        },
    });

/** Show a warning toast */
export const showWarning = (message: string, duration = BASE_DURATION): string =>
    toast(message, {
        duration,
        icon: '⚠️',
        style: {
            ...baseStyle,
            background: '#fffbeb',
            color: '#b45309',
        },
    });

/**
 * Show a loading toast that you dismiss manually.
 * Returns the toast ID so you can call `toast.dismiss(id)` later.
 */
export const showLoading = (message: string): string =>
    toast.loading(message, {
        style: {
            ...baseStyle,
            background: '#f8fafc',
            color: '#334155',
        },
    });

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

interface ConfirmOptions {
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean; // true → confirm button is red
}

/**
 * Show a confirmation toast with two action buttons.
 * Does NOT auto-dismiss — waits for user to press confirm or cancel.
 * Use this to REPLACE all window.confirm() calls.
 */
export const showConfirm = ({
    message,
    onConfirm,
    confirmLabel = 'Đồng ý',
    cancelLabel = 'Huỷ',
    destructive = false,
}: ConfirmOptions): void => {
    toast(
        (t) =>
            React.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column' as const, gap: 10 } },
                React.createElement(
                    'span',
                    { style: { fontFamily: "'Baloo 2', sans-serif", fontWeight: 600, fontSize: '0.95rem', color: '#1e293b' } },
                    message
                ),
                React.createElement(
                    'div',
                    { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
                    React.createElement(
                        'button',
                        {
                            onClick: () => toast.dismiss(t.id),
                            style: {
                                padding: '7px 14px',
                                borderRadius: 10,
                                border: '1.5px solid #e2e8f0',
                                background: '#f8fafc',
                                color: '#475569',
                                cursor: 'pointer',
                                fontFamily: "'Baloo 2', sans-serif",
                                fontWeight: 600,
                                fontSize: '0.88rem',
                                minHeight: 36,
                            },
                        },
                        cancelLabel
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => {
                                toast.dismiss(t.id);
                                onConfirm();
                            },
                            style: {
                                padding: '7px 14px',
                                borderRadius: 10,
                                border: 'none',
                                background: destructive ? '#ef4444' : '#16a34a',
                                color: '#fff',
                                cursor: 'pointer',
                                fontFamily: "'Baloo 2', sans-serif",
                                fontWeight: 700,
                                fontSize: '0.88rem',
                                minHeight: 36,
                            },
                        },
                        confirmLabel
                    )
                )
            ),
        {
            duration: Infinity, // User must explicitly dismiss
            style: {
                ...baseStyle,
                background: '#ffffff',
                maxWidth: 360,
            },
        }
    );
};
